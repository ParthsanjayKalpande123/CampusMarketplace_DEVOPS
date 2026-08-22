'use strict';

/**
 * src/controllers/auth.controller.js
 *
 * HTTP handlers for authentication routes.
 *
 * Controllers are responsible for:
 *  - Receiving the HTTP request.
 *  - Calling the auth service.
 *  - Setting / clearing the JWT cookie.
 *  - Sending the HTTP response.
 *
 * Controllers do NOT contain business logic.
 * All business logic lives in auth.service.js.
 */

const authService = require('../services/auth.service');
const apiResponse = require('../utils/apiResponse');
const { config } = require('../config/env');

/**
 * POST /api/v1/auth/register
 * Registers a new student account.
 * Does NOT auto-login — user must call /login separately.
 *
 * @type {import('express').RequestHandler}
 */
async function register(req, res, next) {
  try {
    const { name, email, password, college, phone } = req.body;

    const user = await authService.register({ name, email, password, college, phone });

    return apiResponse.created(res, { user }, 'Registration successful. Please log in to continue.');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticates a user and sets the JWT in an HTTP-only cookie.
 *
 * Architecture LOCK-3: JWT stored in HTTP-only cookie only.
 * Never returned in the response body.
 *
 * @type {import('express').RequestHandler}
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { token, user } = await authService.login(email, password);

    // Set JWT in HTTP-only cookie — never exposed to JavaScript
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.cookie.secure && req.protocol === 'https',
      sameSite: config.cookie.sameSite,   // 'lax' in development
      maxAge: config.cookie.maxAge,       // 7 days in ms
    });

    return apiResponse.success(res, { user }, 'Login successful.');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 * Clears the JWT cookie. No server-side token invalidation needed
 * since JWT is stateless (short expiry enforced via JWT_EXPIRES_IN).
 *
 * @type {import('express').RequestHandler}
 */
function logout(req, res, next) {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: config.cookie.secure && req.protocol === 'https',
      sameSite: config.cookie.sameSite,
    });

    return apiResponse.success(res, null, 'You have been logged out successfully.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, logout };
