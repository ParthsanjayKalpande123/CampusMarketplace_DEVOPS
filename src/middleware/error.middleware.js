'use strict';

/**
 * src/middleware/error.middleware.js
 *
 * Global Express error handler — must be registered LAST in app.js.
 *
 * Responsibilities:
 *  1. Transform known Mongoose / JWT errors into operational AppErrors.
 *  2. Log the error with appropriate severity.
 *  3. Return a sanitised JSON response (no stack traces or internals in production).
 *
 * Express requires exactly four arguments for error-handling middleware.
 * The eslint disable comment below is intentional.
 */

const { AppError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { config } = require('../config/env');

// ------------------------------------------------------------------
// Error transformers — convert known third-party errors to AppErrors
// ------------------------------------------------------------------

function handleCastError(err) {
  return new AppError(`Invalid value for field '${err.path}': ${err.value}.`, 400, 'INVALID_ID');
}

function handleDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : '';
  const friendlyField = field.charAt(0).toUpperCase() + field.slice(1);
  return new AppError(
    `${friendlyField} '${value}' is already in use. Please choose a different value.`,
    409,
    'DUPLICATE_KEY'
  );
}

function handleMongooseValidationError(err) {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new ValidationError(messages.join(' '), []);
}

function handleJWTError() {
  return new AppError('Invalid token. Please log in again.', 401, 'TOKEN_INVALID');
}

function handleJWTExpiredError() {
  return new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
}

// ------------------------------------------------------------------
// Global error handler
// ------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let appError = err;

  // Transform known third-party errors into operational AppErrors.
  // Only run when the error is NOT already one of our AppError subclasses
  // (identified by isOperational). Our custom ValidationError has
  // err.name === 'ValidationError' too, and must NOT be transformed here.
  if (!err.isOperational) {
    if (err.name === 'CastError') appError = handleCastError(err);
    else if (err.code === 11000) appError = handleDuplicateKeyError(err);
    else if (err.name === 'ValidationError') appError = handleMongooseValidationError(err);
    else if (err.name === 'JsonWebTokenError') appError = handleJWTError();
    else if (err.name === 'TokenExpiredError') appError = handleJWTExpiredError();
  }

  // Determine severity and log accordingly
  if (!appError.isOperational) {
    // Programming error — log everything
    logger.error('Unexpected application error', {
      message: appError.message,
      stack: appError.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
  } else {
    // Operational error — log at warn level
    logger.warn('Operational error', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      method: req.method,
      url: req.originalUrl,
    });
  }

  const statusCode = appError.statusCode || 500;
  const code = appError.code || 'INTERNAL_ERROR';

  // Safe message: expose operational error messages; hide internals of bugs
  const message = appError.isOperational
    ? appError.message
    : 'An unexpected error occurred. Please try again later.';

  const responseBody = {
    success: false,
    error: { code, message },
  };

  // Include per-field validation details if present
  if (appError.fields && appError.fields.length > 0) {
    responseBody.error.fields = appError.fields;
  }

  // In development, include the stack trace in the response for easier debugging
  if (config.isDevelopment && appError.stack) {
    responseBody.error.stack = appError.stack;
  }

  // API routes always return JSON; view routes render an EJS error page
  if (req.path.startsWith('/api/')) {
    return res.status(statusCode).json(responseBody);
  }

  // EJS error page — res.locals may or may not have been set by setLocals
  return res.status(statusCode).render('pages/error', {
    title:           `Error ${statusCode} — Campus Marketplace`,
    statusCode,
    message,
    isAuthenticated: res.locals.isAuthenticated || false,
    user:            res.locals.user            || null,
    currentPath:     req.path,
  });
}

module.exports = errorMiddleware;
