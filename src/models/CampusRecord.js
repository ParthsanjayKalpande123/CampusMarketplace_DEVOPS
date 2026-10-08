'use strict';

const { Schema, model, Types } = require('mongoose');

const campusRecordSchema = new Schema(
  {
    owner: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['wishlist', 'saved-search', 'notification', 'recently-viewed', 'block'],
      required: true,
    },
    product: { type: Types.ObjectId, ref: 'Product', default: null },
    targetUser: { type: Types.ObjectId, ref: 'User', default: null },
    title: { type: String, trim: true, maxlength: 120, default: null },
    filters: { type: Schema.Types.Mixed, default: null },
    content: { type: String, trim: true, maxlength: 500, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

campusRecordSchema.index(
  { owner: 1, type: 1, product: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'wishlist', product: { $type: 'objectId' } },
  }
);
campusRecordSchema.index(
  { owner: 1, type: 1, targetUser: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'block', targetUser: { $type: 'objectId' } },
  }
);
campusRecordSchema.index({ type: 1, createdAt: -1 });

module.exports = model('CampusRecord', campusRecordSchema);
