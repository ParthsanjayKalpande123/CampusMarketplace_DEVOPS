'use strict';

const Message = require('../models/Message');
const Product = require('../models/Product');
const { NotFoundError, AuthorizationError } = require('../utils/errors');
const campusFeatures = require('./campus-feature.service');

/**
 * Sends a new in-app message.
 */
async function sendMessage(senderId, receiverId, productId, content) {
  if (await campusFeatures.isBlocked(senderId, receiverId)) {
    throw new AuthorizationError('Messaging is unavailable because one user has blocked the other.');
  }
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('Product');

  const message = await Message.create({
    sender:   senderId,
    receiver: receiverId,
    product:  productId,
    content,
  });
  await campusFeatures.notify(receiverId, 'You received a new marketplace message.', productId, senderId);

  return Message.findById(message._id)
    .populate('sender', 'name college profileImage')
    .populate('receiver', 'name college profileImage')
    .populate('product', 'title price imageUrl')
    .lean();
}

/**
 * Retrieves the full chat history between two users.
 */
async function getChatHistory(userId1, userId2) {
  if (await campusFeatures.isBlocked(userId1, userId2)) {
    throw new AuthorizationError('This conversation is unavailable.');
  }
  return Message.find({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 },
    ],
  })
    .sort({ createdAt: 1 })
    .populate('sender', 'name college profileImage')
    .populate('receiver', 'name college profileImage')
    .populate('product', 'title price imageUrl')
    .lean();
}

/**
 * Retrieves the list of active conversations for a user.
 */
async function getConversations(userId) {
  const messages = await Message.find({
    $or: [
      { sender: userId },
      { receiver: userId },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('sender', 'name college profileImage')
    .populate('receiver', 'name college profileImage')
    .populate('product', 'title price imageUrl')
    .lean();

  const conversationsMap = {};
  for (const msg of messages) {
    const otherUser = msg.sender._id.toString() === userId.toString() ? msg.receiver : msg.sender;
    if (await campusFeatures.isBlocked(userId, otherUser._id)) continue;
    const key = otherUser._id.toString();
    if (!conversationsMap[key]) {
      conversationsMap[key] = {
        otherUser,
        lastMessage: msg,
        product: msg.product,
      };
    }
  }

  return Object.values(conversationsMap);
}

module.exports = {
  sendMessage,
  getChatHistory,
  getConversations,
};
