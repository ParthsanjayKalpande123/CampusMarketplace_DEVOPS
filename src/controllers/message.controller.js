'use strict';

const messageService = require('../services/message.service');
const apiResponse    = require('../utils/apiResponse');

/**
 * Send a new in-app message.
 * POST /api/v1/messages
 */
async function send(req, res, next) {
  try {
    const { receiverId, productId, content } = req.body;
    if (!receiverId || !productId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'receiverId, productId, and content are required.' },
      });
    }

    const message = await messageService.sendMessage(
      req.user._id,
      receiverId,
      productId,
      content.trim()
    );

    return apiResponse.created(res, { message }, 'Message sent successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * Fetch chat history with a specific user.
 * GET /api/v1/messages/chat/:userId
 */
async function getChat(req, res, next) {
  try {
    const messages = await messageService.getChatHistory(req.user._id, req.params.userId);
    return apiResponse.success(res, { messages }, 'Chat history fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * Fetch list of active conversations.
 * GET /api/v1/messages/conversations
 */
async function getConversations(req, res, next) {
  try {
    const conversations = await messageService.getConversations(req.user._id);
    return apiResponse.success(res, { conversations }, 'Conversations fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  send,
  getChat,
  getConversations,
};
