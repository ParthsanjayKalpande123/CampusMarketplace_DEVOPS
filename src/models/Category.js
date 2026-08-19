'use strict';

/**
 * src/models/Category.js
 *
 * Mongoose schema for the categories collection.
 *
 * Categories are admin-managed. isActive flag controls visibility
 * to students — deactivated categories are hidden from the marketplace
 * but preserved for historical product references.
 *
 * Default categories (seeded in Phase 4):
 *   Books, Electronics, Academic Equipment, Furniture, Bags,
 *   Cycles, Project Components, Sports, Other
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required.'],
      unique: true,
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters.'],
      maxlength: [100, 'Category name cannot exceed 100 characters.'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters.'],
      default: null,
    },

    /**
     * Controls whether students can see and select this category.
     * Admins can see all categories regardless of this flag.
     */
    isActive: {
      type: Boolean,
      default: true,
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

// { name: 1 } index is already created by unique:true on the name field above.
categorySchema.index({ isActive: 1 });

// ------------------------------------------------------------------
// Model
// ------------------------------------------------------------------

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
