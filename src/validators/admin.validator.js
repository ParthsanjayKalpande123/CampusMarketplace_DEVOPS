'use strict';

/**
 * src/validators/admin.validator.js
 *
 * express-validator rules for admin-only mutation endpoints.
 */

const { body, param } = require('express-validator');

/** PATCH /admin/users/:id/role */
const updateRoleRules = [
  param('id')
    .isMongoId().withMessage('User ID must be a valid ID.'),

  body('role')
    .notEmpty().withMessage('Role is required.')
    .bail()
    .isIn(['student', 'admin']).withMessage('Role must be either student or admin.'),
];

/** PATCH /admin/reports/:id/status */
const updateReportStatusRules = [
  param('id')
    .isMongoId().withMessage('Report ID must be a valid ID.'),

  body('status')
    .notEmpty().withMessage('Status is required.')
    .bail()
    .isIn(['reviewed', 'resolved']).withMessage('Status must be reviewed or resolved.'),
];

module.exports = { updateRoleRules, updateReportStatusRules };
