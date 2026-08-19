'use strict';

/**
 * src/controllers/user.controller.js
 *
 * HTTP handlers for authenticated user profile routes.
 * Both endpoints require verifyToken middleware (set in routes).
 */

const userService = require('../services/user.service');
const apiResponse = require('../utils/apiResponse');

/**
 * GET /api/v1/users/me
 * Returns the authenticated user's profile.
 *
 * @type {import('express').RequestHandler}
 */
async function getMe(req, res, next) {
  try {
    // req.user is set by verifyToken middleware
    // We re-fetch from DB to ensure data is current
    const user = await userService.getProfile(req.user._id);
    return apiResponse.success(res, { user }, 'Profile fetched successfully.');
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/v1/users/me
 * Updates the authenticated user's profile.
 * Only whitelisted fields are updated (enforced in service).
 *
 * @type {import('express').RequestHandler}
 */
async function updateMe(req, res, next) {
  try {
    const { name, phone, college, profileImage } = req.body;

    const user = await userService.updateProfile(req.user._id, {
      name,
      phone,
      college,
      profileImage,
    });

    return apiResponse.success(res, { user }, 'Profile updated successfully.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe, updateMe };
