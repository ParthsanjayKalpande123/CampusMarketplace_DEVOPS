'use strict';

/**
 * src/validators/category.validator.js
 *
 * express-validator rule chains for admin category management endpoints.
 */

const { body } = require('express-validator');

/**
 * Validation rules for POST /api/v1/categories (admin)
 */
const createCategoryRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .bail()
    .isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters.'),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
];

/**
 * Validation rules for PATCH /api/v1/categories/:id (admin)
 */
const updateCategoryRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters.'),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean.'),
];

module.exports = { createCategoryRules, updateCategoryRules };
