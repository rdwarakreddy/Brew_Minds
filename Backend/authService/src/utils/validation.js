/**
 * validation.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Defines the exact SHAPE we require for each incoming request body
 *   using Zod. Validating at the edge (before any database call) means
 *   bad/malicious input is rejected with a clear 400 error immediately,
 *   instead of causing confusing failures deeper in the code or, worse,
 *   being silently accepted.
 */

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  email: z.string().trim().email('Enter a valid email address').max(255),
  // Requires at least one letter and one number, min length 8 -- a
  // reasonable balance between security and not frustrating users.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  companyName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  // The ID token issued by Google Identity Services on the frontend.
  // We verify this server-side against Google -- we never trust profile
  // data sent directly from the client without that verification step.
  idToken: z.string().min(10, 'Missing Google ID token'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Missing refresh token'),
});

module.exports = { registerSchema, loginSchema, googleAuthSchema, refreshSchema };
