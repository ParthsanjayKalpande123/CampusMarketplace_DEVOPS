'use strict';

/**
 * src/models/Product.js
 *
 * Mongoose schema for marketplace product listings.
 *
 * Design decisions:
 *  - seller is stored as an ObjectId ref; never embedded (user data can change).
 *  - imageUrl is a URL string — no binary uploads in Phase 1-6 (LOCK-17).
 *  - status drives marketplace availability; 'available' is the only public state.
 *  - isExchangeable signals willingness to barter in addition to / instead of sale.
 *  - Compound index on (status, createdAt) optimises the default product listing query.
 */

const { Schema, model, Types } = require('mongoose');

const CONDITION_VALUES = ['new', 'like-new', 'good', 'fair', 'poor'];
const STATUS_VALUES    = ['available', 'sold', 'exchanged', 'inactive'];

const productSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required.'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters.'],
      maxlength: [200, 'Title cannot exceed 200 characters.'],
    },

    description: {
      type: String,
      required: [true, 'Product description is required.'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters.'],
      maxlength: [2000, 'Description cannot exceed 2000 characters.'],
    },

    category: {
      type: Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required.'],
    },

    price: {
      type: Number,
      required: [true, 'Price is required.'],
      min: [0, 'Price cannot be negative.'],
      max: [999999, 'Price cannot exceed 999,999.'],
    },

    condition: {
      type: String,
      required: [true, 'Condition is required.'],
      enum: {
        values: CONDITION_VALUES,
        message: `Condition must be one of: ${CONDITION_VALUES.join(', ')}.`,
      },
    },

    /**
     * URL pointing to an image hosted externally (S3, Cloudinary, etc.).
     * Uploads are out of scope for Phases 1–6 (LOCK-17).
     */
    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    seller: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required.'],
    },

    /** Approximate location, e.g. "Hostel Block A" or "Main Campus" */
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters.'],
      default: null,
    },

    /** Whether the seller is open to exchanging instead of (or alongside) selling */
    isExchangeable: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: `Status must be one of: ${STATUS_VALUES.join(', ')}.`,
      },
      default: 'available',
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

// Primary listing query: status=available, ordered by createdAt desc
productSchema.index({ status: 1, createdAt: -1 });

// "My listings" — fetch all products by a seller
productSchema.index({ seller: 1, createdAt: -1 });

// Category filter
productSchema.index({ category: 1 });

// Price range queries
productSchema.index({ price: 1 });

// Text search on title and description
productSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 1 }, name: 'product_text_idx' }
);

// ------------------------------------------------------------------
// Statics
// ------------------------------------------------------------------

/** Exported enum values so other modules (validators, services) share the same source. */
productSchema.statics.CONDITION_VALUES = CONDITION_VALUES;
productSchema.statics.STATUS_VALUES    = STATUS_VALUES;

const Product = model('Product', productSchema);

module.exports = Product;
