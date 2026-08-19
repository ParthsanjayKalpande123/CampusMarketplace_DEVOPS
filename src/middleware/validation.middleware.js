'use strict';

/**
 * src/middleware/validation.middleware.js
 *
 * Collects express-validator errors and converts them to a
 * ValidationError that the global error handler will format
 * consistently.
 *
 * Usage pattern:
 *
 *   const { body } = require('express-validator');
 *   const { validate } = require('../middleware/validation.middleware');
 *
 *   router.post(
 *     '/register',
 *     [
 *       body('email').isEmail().withMessage('A valid email is required.'),
 *       body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
 *     ],
 *     validate,
 *     authController.register
 *   );
 */

const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Runs after express-validator rule chains.
 * Throws a ValidationError if any rule failed.
 *
 * @type {import('express').RequestHandler}
 */
function validate(req, res, next) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const fields = result.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(new ValidationError('Validation failed. Please correct the highlighted fields.', fields));
  }

  return next();
}

module.exports = { validate };
