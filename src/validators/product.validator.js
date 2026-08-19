'use strict';

/**
 * src/validators/product.validator.js
 *
 * express-validator rule chains for product endpoints.
 */

const { body } = require('express-validator');

const CONDITION_VALUES = ['new', 'like-new', 'good', 'fair', 'poor'];
const STATUS_VALUES    = ['available', 'sold', 'exchanged', 'inactive'];

/**
 * Validation rules for POST /api/v1/products
 */
const createProductRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .bail()
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters.'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required.')
    .bail()
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be between 10 and 2000 characters.'),

  body('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
    .bail()
    .isMongoId().withMessage('Category must be a valid ID.'),

  body('price')
    .notEmpty().withMessage('Price is required.')
    .bail()
    .isFloat({ min: 0, max: 999999 }).withMessage('Price must be between 0 and 999,999.'),

  body('condition')
    .notEmpty().withMessage('Condition is required.')
    .bail()
    .isIn(CONDITION_VALUES)
    .withMessage(`Condition must be one of: ${CONDITION_VALUES.join(', ')}.`),

  body('imageUrl')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Image URL must be a valid URL.'),

  body('location')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters.'),

  body('isExchangeable')
    .optional()
    .isBoolean().withMessage('isExchangeable must be a boolean.'),
];

/**
 * Validation rules for PUT /api/v1/products/:id
 * All fields are optional — only the provided ones are updated.
 */
const updateProductRules = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters.'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be between 10 and 2000 characters.'),

  body('category')
    .optional()
    .bail()
    .isMongoId().withMessage('Category must be a valid ID.'),

  body('price')
    .optional()
    .isFloat({ min: 0, max: 999999 }).withMessage('Price must be between 0 and 999,999.'),

  body('condition')
    .optional()
    .isIn(CONDITION_VALUES)
    .withMessage(`Condition must be one of: ${CONDITION_VALUES.join(', ')}.`),

  body('imageUrl')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Image URL must be a valid URL.'),

  body('location')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters.'),

  body('isExchangeable')
    .optional()
    .isBoolean().withMessage('isExchangeable must be a boolean.'),

  // Disallow fields that go through dedicated endpoints
  body('status')
    .not().exists()
    .withMessage('Use PATCH /:id/status to update product status.'),

  body('seller')
    .not().exists()
    .withMessage('Seller cannot be changed.'),
];

/**
 * Validation rules for PATCH /api/v1/products/:id/status
 */
const updateStatusRules = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .bail()
    .isIn(STATUS_VALUES)
    .withMessage(`Status must be one of: ${STATUS_VALUES.join(', ')}.`),
];

module.exports = { createProductRules, updateProductRules, updateStatusRules };
