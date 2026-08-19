'use strict';

/**
 * src/utils/errors.js
 *
 * Custom error classes for the application.
 *
 * isOperational = true  → Expected business error (returned to client as-is).
 * isOperational = false → Programming bug (logged fully, generic message sent to client).
 *
 * The global error handler in error.middleware.js uses this flag
 * to decide how much detail to expose in API responses.
 */

/**
 * Base application error class.
 * All custom errors extend this.
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable, safe-to-expose message.
   * @param {number} statusCode - HTTP status code.
   * @param {string} code      - Machine-readable error code (e.g. 'NOT_FOUND').
   */
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 — Input failed validation rules.
 * Optionally carries per-field error details.
 */
class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {Array<{field: string, message: string}>} [fields]
   */
  constructor(message = 'Validation failed', fields = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * 401 — Unauthenticated request (no token, bad token, expired token).
 */
class AuthenticationError extends AppError {
  /**
   * @param {string} [message]
   * @param {string} [code]
   */
  constructor(message = 'Authentication required. Please log in.', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 — Authenticated but not permitted to perform the action.
 */
class AuthorizationError extends AppError {
  /**
   * @param {string} [message]
   */
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 404 — Requested resource does not exist.
 */
class NotFoundError extends AppError {
  /**
   * @param {string} [resource] - Human-readable resource name (e.g. 'Product').
   */
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'NOT_FOUND');
  }
}

/**
 * 409 — Conflict with existing data (e.g. duplicate email).
 */
class ConflictError extends AppError {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
};
