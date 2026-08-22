'use strict';

const { Router } = require('express');
const messageController = require('../controllers/message.controller');
const { verifyToken }   = require('../middleware/auth.middleware');

const router = Router();

// Apply auth to all message routes
router.use(verifyToken);

/**
 * POST /api/v1/messages
 * Send a message
 */
router.post('/', messageController.send);

/**
 * GET /api/v1/messages/conversations
 * Get all conversations list
 */
router.get('/conversations', messageController.getConversations);

/**
 * GET /api/v1/messages/chat/:userId
 * Get chat history with a user
 */
router.get('/chat/:userId', messageController.getChat);

module.exports = router;
