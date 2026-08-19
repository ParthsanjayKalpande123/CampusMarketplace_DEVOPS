'use strict';

/**
 * src/routes/user.routes.js
 *
 * User profile routes — get and update the authenticated user's own profile.
 * All routes require authentication (verifyToken).
 */

const { Router } = require('express');

const userController = require('../controllers/user.controller');
const { updateProfileRules } = require('../validators/user.validator');
const { validate } = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

const router = Router();

// All user routes require authentication
router.use(verifyToken);

/**
 * GET /api/v1/users/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', userController.getMe);

/**
 * PUT /api/v1/users/me
 * Updates the currently authenticated user's profile.
 * Body: { name?, phone?, college?, profileImage? }
 */
router.put('/me', updateProfileRules, validate, userController.updateMe);

module.exports = router;
