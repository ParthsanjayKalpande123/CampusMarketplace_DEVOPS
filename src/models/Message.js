'use strict';

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const messageSchema = new Schema(
  {
    sender: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required.'],
    },
    receiver: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required.'],
    },
    product: {
      type: Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required.'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required.'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters.'],
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

// Indexes for query performance
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
