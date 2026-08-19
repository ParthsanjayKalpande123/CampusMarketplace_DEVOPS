'use strict';

/**
 * src/utils/apiResponse.js
 *
 * Standardised JSON response helpers.
 *
 * All controllers must use these functions instead of calling
 * res.json() directly, ensuring a consistent response envelope
 * across every endpoint in the application.
 *
 * Success envelope:
 *   { success: true, message: string, data: any }
 *
 * Error envelope:
 *   { success: false, error: { code: string, message: string, fields?: [] } }
 *
 * Paginated envelope:
 *   { success: true, message: string, data: { items: [], pagination: {} } }
 */

/**
 * Generic success response.
 *
 * @param {import('express').Response} res
 * @param {any}    data       - Payload to send (null omits the data key).
 * @param {string} message    - Human-readable success message.
 * @param {number} statusCode - HTTP status code (default 200).
 */
function success(res, data = null, message = 'Request successful', statusCode = 200) {
  const body = { success: true, message };
  if (data !== null && data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}

/**
 * 201 Created response.
 *
 * @param {import('express').Response} res
 * @param {any}    data
 * @param {string} message
 */
function created(res, data, message = 'Resource created successfully') {
  return success(res, data, message, 201);
}

/**
 * Error response. Typically called by the global error middleware,
 * not directly by controllers.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {string} code        - Machine-readable error code.
 * @param {number} statusCode
 * @param {Array}  [fields]    - Per-field validation errors.
 */
function error(res, message, code = 'INTERNAL_ERROR', statusCode = 500, fields = null) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (fields && Array.isArray(fields) && fields.length > 0) {
    body.error.fields = fields;
  }
  return res.status(statusCode).json(body);
}

/**
 * Paginated list response.
 *
 * @param {import('express').Response} res
 * @param {Array}  items
 * @param {{ page: number, limit: number, total: number, pages: number }} pagination
 * @param {string} message
 */
function paginated(res, items, pagination, message = 'Data fetched successfully') {
  return res.status(200).json({
    success: true,
    message,
    data: { items, pagination },
  });
}

/**
 * No-content response (204). Used for operations that return no body.
 *
 * @param {import('express').Response} res
 */
function noContent(res) {
  return res.status(204).send();
}

module.exports = { success, created, error, paginated, noContent };
