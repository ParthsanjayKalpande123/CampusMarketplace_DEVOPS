'use strict';

/**
 * src/middleware/admin.middleware.js
 *
 * Role-based authorization middleware for admin-only routes.
 * Must be used AFTER verifyToken — relies on req.user being set.
 *
 * Usage:
 *   router.get('/admin/users', verifyToken, isAdmin, adminController.getUsers);
 */

const { AuthorizationError } = require('../utils/errors');

/**
 * Blocks requests from non-admin users with a 403 response.
 *
 * @type {import('express').RequestHandler}
 */
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(
      new AuthorizationError(
        'This action requires administrator privileges.'
      )
    );
  }
  return next();
}

module.exports = { isAdmin };
