'use strict';

const { Schema, model, Types } = require('mongoose');

const orderSchema = new Schema(
  {
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: Types.ObjectId, ref: 'User', required: true },
    seller: { type: Types.ObjectId, ref: 'User', required: true },
    offer: { type: Types.ObjectId, ref: 'Offer', default: null },
    kind: { type: String, enum: ['purchase', 'exchange'], default: 'exchange' },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    paymentStatus: {
      type: String,
      enum: ['not-integrated', 'not-applicable'],
      default: 'not-integrated',
    },
    pickupAt: { type: Date, default: null },
    qrTokenHash: { type: String, select: false, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });

module.exports = model('Order', orderSchema);
