/**
 * errorHandler.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Two small utilities used by every service:
 *
 *   1. asyncHandler(fn) -- wraps an async Express route handler so any
 *      thrown error / rejected promise is automatically forwarded to
 *      Express's error-handling middleware, instead of us having to
 *      write try/catch in every single controller function.
 *
 *   2. errorHandler -- the LAST middleware mounted in server.js. Any
 *      error passed via next(err) (including from asyncHandler) ends
 *      up here, gets logged, and turned into a clean, consistent JSON
 *      response so the frontend never has to guess the error shape.
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[clientService] Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Postgres unique-violation -> friendly 409 instead of a raw 500
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  // Postgres foreign-key-violation -> the referenced record doesn't exist
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Something went wrong on our end. Please try again.',
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
}

module.exports = { asyncHandler, errorHandler, notFound };
