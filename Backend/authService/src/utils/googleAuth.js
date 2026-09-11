/**
 * googleAuth.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Verifies the Google ID token that the React frontend obtains via
 *   Google Identity Services ("Sign in with Google" button). We use
 *   Google's own library to cryptographically verify the token's
 *   signature against Google's public keys -- this is the step that
 *   proves the token really was issued by Google for OUR app (matching
 *   GOOGLE_CLIENT_ID) and hasn't been tampered with. We never trust a
 *   name/email/picture sent to us directly without this verification.
 */

const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies a Google ID token and returns the trusted profile fields.
 * Throws if the token is invalid, expired, or issued for a different
 * Google Client ID.
 */
async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId || clientId.startsWith('YOUR_') || clientId.includes('YOUR_GOOGLE')) {
    // Still the placeholder from .env.example -- calling Google's
    // library with it would produce a confusing internal error. Fail
    // clearly here instead, with the actual fix, so this doesn't look
    // like a broken feature when it's really just an unset credential.
    const err = new Error(
      'Google sign-in is not configured on this server yet. Set a real GOOGLE_CLIENT_ID in authService/.env -- see EXECUTION.md, section 5.'
    );
    err.statusCode = 501;
    throw err;
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('Google token did not include an email address.');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
    emailVerified: payload.email_verified,
  };
}

module.exports = { verifyGoogleToken };
