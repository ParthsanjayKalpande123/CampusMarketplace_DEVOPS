'use strict';

/**
 * src/services/auth.service.js
 *
 * Business logic for authentication.
 *
 * Rules enforced here:
 *  - Email uniqueness check before creating a user.
 *  - Password hashed with bcrypt cost factor 12 (LOCK-16).
 *  - JWT signed with JWT_SECRET from config (never hardcoded).
 *  - Comparison uses bcrypt.compare to prevent timing attacks.
 *  - passwordHash is never returned to the caller.
 *
 * This service has no knowledge of HTTP request/response objects.
 * All HTTP concerns (cookies, status codes) are handled by the controller.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { config } = require('../config/env');
const { ConflictError, AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/** bcrypt cost factor — locked at 12 (architecture LOCK-16) */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Registers a new student account.
 *
 * @param {{ name: string, email: string, password: string, college?: string, phone?: string }} data
 * @returns {Promise<object>} Safe user object (no passwordHash).
 * @throws {ConflictError} If email is already registered.
 */
async function register(data) {
  const { name, email, password, college, phone } = data;

  // Check email uniqueness before hashing (fail fast)
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError(
      'An account with this email address already exists.',
      'DUPLICATE_EMAIL'
    );
  }

  // Hash password — never store plaintext
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    passwordHash,
    college: college || null,
    phone: phone || null,
    role: 'student', // new registrations are always students
  });

  logger.info('New user registered', { userId: user._id, email: user.email });

  return user.toSafeObject();
}

/**
 * Authenticates a user with email and password.
 * Returns a signed JWT and safe user data on success.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: object }>}
 * @throws {AuthenticationError} If credentials are invalid.
 */
async function login(email, password) {
  // Explicitly select passwordHash — excluded by default (select: false)
  const user = await User.findOne({ email }).select('+passwordHash');

  // Use a generic error message for both "user not found" and "wrong password"
  // to prevent user enumeration attacks.
  const invalidCredentialsError = new AuthenticationError(
    'Invalid email or password.',
    'INVALID_CREDENTIALS'
  );

  if (!user) {
    throw invalidCredentialsError;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw invalidCredentialsError;
  }

  // Sign JWT — payload contains only what auth middleware needs
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  logger.info('User logged in', { userId: user._id, role: user.role });

  // Return safe user object — toJSON transform removes passwordHash
  return { token, user: user.toSafeObject() };
}

module.exports = { register, login };
