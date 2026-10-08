'use strict';

const { Schema, model, Types } = require('mongoose');

const offerSchema = new Schema(
  {
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: Types.ObjectId, ref: 'User', required: true },
    seller: { type: Types.ObjectId, ref: 'User', required: true },
    fromUser: { type: Types.ObjectId, ref: 'User', required: true },
    toUser: { type: Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['price', 'exchange'], required: true },
    amount: { type: Number, min: 0, default: null },
    exchangeProduct: { type: Types.ObjectId, ref: 'Product', default: null },
    additionalCash: { type: Number, min: 0, default: 0 },
    message: { type: String, trim: true, maxlength: 500, default: null },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered', 'withdrawn'],
      default: 'pending',
    },
    parentOffer: { type: Types.ObjectId, ref: 'Offer', default: null },
    order: { type: Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

offerSchema.index({ buyer: 1, createdAt: -1 });
offerSchema.index({ seller: 1, status: 1, createdAt: -1 });
offerSchema.index({ product: 1, createdAt: -1 });

module.exports = model('Offer', offerSchema);
