'use strict';

/**
 * src/routes/auth.routes.js
 *
 * Authentication routes — register, login, logout.
 *
 * A stricter rate limiter is applied here in addition to the global limiter
 * in app.js to mitigate brute-force and credential-stuffing attacks.
 */

const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');

const { config } = require('../config/env');
const authController = require('../controllers/auth.controller');
const { registerRules, loginRules } = require('../validators/auth.validator');
const { validate } = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

const router = Router();

// ------------------------------------------------------------------
// Auth-specific rate limiter (stricter than the global 300/15min)
// ------------------------------------------------------------------

/**
 * Login rate limiter: 10 attempts per 15 minutes per IP.
 * Prevents brute-force password attacks.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    },
  },
});

/**
 * Register rate limiter: 5 accounts per hour per IP.
 * Prevents spam account creation.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
});

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, college?, phone? }
 */
router.post(
  '/register',
  registerLimiter,
  registerRules,
  validate,
  authController.register
);

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Sets HTTP-only JWT cookie on success.
 */
router.post(
  '/login',
  loginLimiter,
  loginRules,
  validate,
  authController.login
);

/**
 * POST /api/v1/auth/logout
 * Clears the JWT cookie. Requires authentication.
 */
router.post(
  '/logout',
  verifyToken,
  authController.logout
);

module.exports = router;
