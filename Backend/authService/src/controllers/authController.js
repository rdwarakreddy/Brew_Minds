/**
 * authController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Implements every authentication use case described in the brief:
 *     1. Manual registration (name/email/password)
 *     2. Manual login
 *     3. Sign up / log in with Google
 *     4. Silent access-token refresh
 *     5. Logout (invalidate the refresh token server-side)
 *     6. "Who am I" (used by the frontend on page load to restore session)
 */

const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');
const { verifyGoogleToken } = require('../utils/googleAuth');
const {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  refreshSchema,
} = require('../utils/validation');
const jwt = require('jsonwebtoken');

// Salt rounds for bcrypt. 12 is a strong, modern default -- high enough
// to be slow for attackers brute-forcing leaked hashes, low enough to
// not noticeably slow down real logins.
const SALT_ROUNDS = 12;

// Shape we always send back for a "user" object -- NEVER includes
// password_hash, even implicitly (we hand-pick fields, we don't just
// spread the DB row).
function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    companyName: row.company_name,
    phone: row.phone,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
  };
}

// Issues both tokens for a user, stores the refresh token's hash, and
// returns everything the frontend needs to establish a session.
async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const decoded = jwt.decode(refreshToken);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, to_timestamp($3))`,
    [user.id, hashToken(refreshToken), decoded.exp]
  );

  return { accessToken, refreshToken, user: toPublicUser(user) };
}

/**
 * POST /api/auth/register
 * Manual registration with name/email/password.
 */
async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { name, email, password, companyName, phone } = parsed.data;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO users (name, email, password_hash, company_name, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email.toLowerCase(), passwordHash, companyName || null, phone || null]
  );

  const session = await issueSession(result.rows[0]);
  res.status(201).json(session);
}

/**
 * POST /api/auth/login
 * Manual login with email/password.
 */
async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { email, password } = parsed.data;

  const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];

  // Deliberately vague error message ("Invalid email or password") for
  // BOTH "no such user" and "wrong password" -- this stops attackers
  // from using the login form to figure out which emails are registered.
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'This account has been deactivated.' });
  }

  const session = await issueSession(user);
  res.json(session);
}

/**
 * POST /api/auth/google
 * Sign up OR log in with Google -- same endpoint handles both: if no
 * user exists with that Google account (or matching email), we create
 * one on the fly (this is what "Signup with Google" means in practice).
 */
async function googleAuth(req, res) {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  let profile;
  try {
    profile = await verifyGoogleToken(parsed.data.idToken);
  } catch (err) {
    // Wrong/misconfigured GOOGLE_CLIENT_ID, an expired/tampered token,
    // or Google's verification service being unreachable all land here.
    console.error('[authService] Google token verification failed:', err.message);

    // verifyGoogleToken already throws a specific, actionable message
    // (e.g. "not configured yet") with its own statusCode for the
    // config-error case -- pass that straight through instead of
    // masking it with a generic one. Anything else (a genuinely invalid
    // or tampered token) still gets a friendly, non-leaky 401.
    if (err.statusCode) throw err;
    const e = new Error(
      'Google sign-in could not be verified. Please try again, or contact support if this keeps happening.'
    );
    e.statusCode = 401;
    throw e;
  }

  // 1. Try to find a user already linked to this exact Google account.
  let result = await query('SELECT * FROM users WHERE google_id = $1', [profile.googleId]);
  let user = result.rows[0];

  if (!user) {
    // 2. Otherwise, see if an account with the same email already
    //    exists (e.g. they registered manually first) -- link Google
    //    to that existing account rather than creating a duplicate.
    result = await query('SELECT * FROM users WHERE email = $1', [profile.email.toLowerCase()]);
    user = result.rows[0];

    if (user) {
      const updated = await query(
        `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2)
         WHERE id = $3 RETURNING *`,
        [profile.googleId, profile.avatarUrl, user.id]
      );
      user = updated.rows[0];
    } else {
      // 3. Brand new user signing up via Google for the first time.
      const created = await query(
        `INSERT INTO users (name, email, google_id, avatar_url)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [profile.name, profile.email.toLowerCase(), profile.googleId, profile.avatarUrl]
      );
      user = created.rows[0];
    }
  }

  const session = await issueSession(user);
  res.json(session);
}

/**
 * POST /api/auth/refresh
 * Exchanges a still-valid refresh token for a brand new access token
 * (and rotates the refresh token, a standard security practice --
 * rotating refresh tokens on every use limits the damage if one is
 * ever stolen: it can only be used once before becoming invalid).
 */
async function refresh(req, res) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { refreshToken } = parsed.data;

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await query(
    `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()`,
    [decoded.sub, tokenHash]
  );

  if (stored.rows.length === 0) {
    return res.status(401).json({ error: 'Refresh token not recognised. Please log in again.' });
  }

  // Rotate: delete the old refresh token record, issue a new pair.
  await query('DELETE FROM refresh_tokens WHERE id = $1', [stored.rows[0].id]);

  const userResult = await query('SELECT * FROM users WHERE id = $1', [decoded.sub]);
  if (userResult.rows.length === 0) {
    return res.status(401).json({ error: 'User no longer exists.' });
  }

  const session = await issueSession(userResult.rows[0]);
  res.json(session);
}

/**
 * POST /api/auth/logout
 * Deletes the refresh token server-side so it can never be used again,
 * even if someone still has a copy of it.
 */
async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(refreshToken)]);
  }
  res.status(204).send();
}

/**
 * GET /api/auth/me
 * Returns the logged-in user's profile. Requires a valid access token
 * (protected by the verifyToken middleware).
 */
async function me(req, res) {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user: toPublicUser(result.rows[0]) });
}

/**
 * PATCH /api/auth/me
 * Lets a user update their own profile (name, company, phone, avatar).
 * Email/password changes are intentionally NOT handled by this simple
 * endpoint since they need extra verification steps in a production app.
 */
async function updateMe(req, res) {
  const { name, companyName, phone, avatarUrl } = req.body;
  const result = await query(
    `UPDATE users
     SET name = COALESCE($1, name),
         company_name = COALESCE($2, company_name),
         phone = COALESCE($3, phone),
         avatar_url = COALESCE($4, avatar_url)
     WHERE id = $5
     RETURNING *`,
    [name, companyName, phone, avatarUrl, req.user.id]
  );
  res.json({ user: toPublicUser(result.rows[0]) });
}

module.exports = { register, login, googleAuth, refresh, logout, me, updateMe };
