'use strict';

/**
 * src/middleware/auth.middleware.js
 *
 * JWT authentication middleware.
 *
 * Token storage: HTTP-only cookie named 'token'.
 * NOT from Authorization header — localStorage is never used.
 *
 * verifyToken   — Requires authentication. Blocks unauthenticated requests.
 * optionalToken — Soft authentication. Attaches req.user if token is valid;
 *                 continues without error if no token is present.
 * isOwner       — Resource ownership check (must be used after verifyToken).
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const User = require('../models/User');

/**
 * Verifies the JWT stored in the 'token' HTTP-only cookie.
 * Fetches the full user document from MongoDB and attaches it to req.user.
 * Blocks the request with 401 if the token is missing, invalid, or expired.
 *
 * @type {import('express').RequestHandler}
 */
async function verifyToken(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;

    if (!token) {
      return next(
        new AuthenticationError(
          'Access denied. Please log in to continue.',
          'TOKEN_MISSING'
        )
      );
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    // Fetch user from DB — ensures the account still exists and is current
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return next(
        new AuthenticationError(
          'Account not found. Please log in again.',
          'USER_NOT_FOUND'
        )
      );
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err); // JWT errors caught and transformed by global error handler
  }
}

/**
 * Soft token verification for public routes that have authenticated variants.
 * Attaches req.user if a valid token is present; otherwise continues silently.
 *
 * @type {import('express').RequestHandler}
 */
async function optionalToken(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return next();

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (user) {
      req.user = user;
    }
    return next();
  } catch {
    // Invalid or expired token — treat as unauthenticated, do not block
    return next();
  }
}

/**
 * Checks that the authenticated user is the owner of the resource.
 * The resource object must be attached to req.resource by the controller
 * before this middleware runs.
 *
 * @param {string} [ownerField='seller'] - The field on the resource that holds the owner's ID.
 * @returns {import('express').RequestHandler}
 */
function isOwner(ownerField = 'seller') {
  return (req, res, next) => {
    const resource = req.resource;

    if (!resource) {
      return next(
        new AuthorizationError('Ownership check failed: resource was not found.')
      );
    }

    const ownerId = resource[ownerField];
    if (!ownerId || !ownerId.equals(req.user._id)) {
      return next(
        new AuthorizationError('You do not have permission to modify this resource.')
      );
    }

    return next();
  };
}

module.exports = { verifyToken, optionalToken, isOwner };
