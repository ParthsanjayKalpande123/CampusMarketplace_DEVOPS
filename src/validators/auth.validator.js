'use strict';

/**
 * src/validators/auth.validator.js
 *
 * express-validator rule chains for authentication endpoints.
 * These arrays are spread into route definitions and run before
 * the validate middleware and controller.
 *
 * Usage:
 *   router.post('/register', registerRules, validate, authController.register);
 */

const { body } = require('express-validator');

/**
 * Validation rules for POST /api/v1/auth/register
 */
const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .bail()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .isLength({ max: 128 })
    .withMessage('Password cannot exceed 128 characters.'),

  body('college')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('College name cannot exceed 200 characters.'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('Please provide a valid phone number.'),
];

/**
 * Validation rules for POST /api/v1/auth/login
 */
const loginRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required.')
    .bail()                   // stop chain if empty — prevents normalizeEmail from running on undefined
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

module.exports = { registerRules, loginRules };
