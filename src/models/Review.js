'use strict';

const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema(
  {
    order: { type: Types.ObjectId, ref: 'Order', required: true },
    author: { type: Types.ObjectId, ref: 'User', required: true },
    targetUser: { type: Types.ObjectId, ref: 'User', required: true },
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['seller', 'product'], required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, author: 1, type: 1 }, { unique: true });
reviewSchema.index({ targetUser: 1, type: 1, createdAt: -1 });
reviewSchema.index({ product: 1, type: 1, createdAt: -1 });

module.exports = model('Review', reviewSchema);
