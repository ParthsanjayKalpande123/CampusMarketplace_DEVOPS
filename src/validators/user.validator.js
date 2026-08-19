'use strict';

/**
 * src/validators/user.validator.js
 *
 * express-validator rule chains for user profile endpoints.
 */

const { body } = require('express-validator');

/**
 * Validation rules for PUT /api/v1/users/me
 *
 * Only these fields are allowed to be updated.
 * Email and role are NOT updateable through this endpoint.
 * Password changes are handled separately (future phase).
 */
const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),

  body('phone')
    .optional({ nullable: true })
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('Please provide a valid phone number.'),

  body('college')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('College name cannot exceed 200 characters.'),

  body('profileImage')
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage('Profile image must be a valid URL.'),

  // Explicitly reject disallowed fields
  body('email')
    .not()
    .exists()
    .withMessage('Email cannot be changed through this endpoint.'),

  body('role')
    .not()
    .exists()
    .withMessage('Role cannot be changed through this endpoint.'),

  body('passwordHash')
    .not()
    .exists()
    .withMessage('Password cannot be set through this endpoint.'),
];

module.exports = { updateProfileRules };
