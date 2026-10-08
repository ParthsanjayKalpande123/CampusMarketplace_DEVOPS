'use strict';

/**
 * src/validators/report.validator.js
 *
 * express-validator rule chains for report endpoints.
 */

const { body } = require('express-validator');

const REASON_VALUES = [
  'spam',
  'inappropriate',
  'wrong_price',
  'item_unavailable',
  'fraud',
  'harassment',
  'misleading_information',
  'off_platform_payment',
  'fake_listing',
  'other',
];

/**
 * Validation rules for POST /api/v1/reports
 */
const createReportRules = [
  body('productId')
    .trim()
    .notEmpty().withMessage('Product ID is required.')
    .bail()
    .isMongoId().withMessage('Product ID must be a valid ID.'),

  body('reason')
    .notEmpty().withMessage('Report reason is required.')
    .bail()
    .isIn(REASON_VALUES)
    .withMessage(`Reason must be one of: ${REASON_VALUES.join(', ')}.`),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
];

module.exports = { createReportRules };
