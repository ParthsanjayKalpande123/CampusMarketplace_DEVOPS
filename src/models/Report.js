'use strict';

/**
 * src/models/Report.js
 *
 * Mongoose schema for product listing reports.
 *
 * Design decisions:
 *  - Compound unique index on (product, reportedBy) prevents duplicate reports
 *    from the same user for the same product.
 *  - status is admin-managed: pending → reviewed → resolved.
 *  - Products are never deleted when reported; status is managed separately.
 */

const { Schema, model, Types } = require('mongoose');

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

const STATUS_VALUES = ['pending', 'reviewed', 'resolved'];

const reportSchema = new Schema(
  {
    product: {
      type: Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    reportedSeller: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reportedBy: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required.'],
    },

    targetType: {
      type: String,
      enum: ['listing', 'seller'],
      default: 'listing',
    },

    reason: {
      type: String,
      required: [true, 'Report reason is required.'],
      enum: {
        values: REASON_VALUES,
        message: `Reason must be one of: ${REASON_VALUES.join(', ')}.`,
      },
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters.'],
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: `Status must be one of: ${STATUS_VALUES.join(', ')}.`,
      },
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ------------------------------------------------------------------
// Indexes
// ------------------------------------------------------------------

// Prevent one user from reporting the same product more than once
reportSchema.index(
  { product: 1, reportedBy: 1 },
  { unique: true, partialFilterExpression: { product: { $type: 'objectId' } } }
);
reportSchema.index(
  { reportedSeller: 1, reportedBy: 1 },
  { unique: true, partialFilterExpression: { reportedSeller: { $type: 'objectId' } } }
);

// Admin dashboard — filter by status
reportSchema.index({ status: 1, createdAt: -1 });

// ------------------------------------------------------------------
// Statics
// ------------------------------------------------------------------

reportSchema.statics.REASON_VALUES = REASON_VALUES;
reportSchema.statics.STATUS_VALUES = STATUS_VALUES;

const Report = model('Report', reportSchema);

module.exports = Report;
