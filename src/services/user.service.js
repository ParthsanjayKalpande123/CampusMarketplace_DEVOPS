'use strict';

/**
 * src/services/user.service.js
 *
 * Business logic for user profile management.
 *
 * Only these fields may be updated by the user:
 *   name, phone, college, profileImage
 *
 * Email and role are NOT updatable through the self-service profile endpoint.
 * Password changes are a separate future concern.
 */

const User = require('../models/User');
const { NotFoundError } = require('../utils/errors');

/**
 * Retrieves the authenticated user's profile.
 *
 * @param {string} userId - Mongoose ObjectId string from req.user._id
 * @returns {Promise<object>} Safe user object.
 * @throws {NotFoundError} If the user no longer exists.
 */
async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  return user.toSafeObject();
}

/**
 * Updates the authenticated user's profile.
 * Only explicitly listed fields are updated — no mass-assignment risk.
 *
 * @param {string} userId
 * @param {{ name?: string, phone?: string, college?: string, profileImage?: string }} updates
 * @returns {Promise<object>} Updated safe user object.
 * @throws {NotFoundError} If the user no longer exists.
 */
async function updateProfile(userId, updates) {
  // Whitelist: only these fields may be changed
  const ALLOWED_FIELDS = ['name', 'phone', 'college', 'profileImage'];

  const safeUpdates = {};
  ALLOWED_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safeUpdates[field] = updates[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: safeUpdates },
    {
      new: true,          // return the updated document
      runValidators: true, // run schema validators on update
    }
  );

  if (!user) {
    throw new NotFoundError('User');
  }

  return user.toSafeObject();
}

module.exports = { getProfile, updateProfile };
