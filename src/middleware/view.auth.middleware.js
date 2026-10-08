'use strict';

/**
 * src/middleware/view.auth.middleware.js
 *
 * Middleware for EJS view routes — distinct from the API auth middleware.
 *
 * setLocals  — Applied globally to all view routes. Soft auth check: decodes
 *              the JWT cookie if present and sets res.locals.user /
 *              res.locals.isAuthenticated. Does NOT reject unauthenticated
 *              requests — only enriches the template context.
 *
 * requireAuth — Applied to protected view routes. Redirects unauthenticated
 *               requests to /login instead of returning 401 JSON.
 */

const jwt  = require('jsonwebtoken');
const { config } = require('../config/env');
const User = require('../models/User');
const CampusRecord = require('../models/CampusRecord');

/**
 * Soft auth — decode JWT cookie and set res.locals.
 * Safe to use on all view routes (public and protected).
 *
 * Sets:
 *   res.locals.user             — User document or null
 *   res.locals.isAuthenticated  — boolean
 *   res.locals.currentPath      — req.path for active link highlighting
 *
 * @type {import('express').RequestHandler}
 */
async function setLocals(req, res, next) {
  res.locals.user            = null;
  res.locals.isAuthenticated = false;
  res.locals.currentPath     = req.path;
  res.locals.unreadNotificationCount = 0;

  const token = req.cookies && req.cookies.token;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user    = await User.findById(decoded.userId).select('-passwordHash').lean();

    if (user) {
      req.user                   = user;
      res.locals.user            = user;
      res.locals.isAuthenticated = true;
    }
  } catch {
    // Expired or tampered token — treat as unauthenticated
    res.clearCookie('token');
  }

  if (res.locals.isAuthenticated) {
    try {
      res.locals.unreadNotificationCount = await CampusRecord.countDocuments({
        owner: res.locals.user._id,
        type: 'notification',
        readAt: null,
      });
    } catch (error) {
      return next(error);
    }
  }

  return next();
}

/**
 * Hard auth — redirect to /login if not authenticated.
 * Must be used AFTER setLocals.
 *
 * @type {import('express').RequestHandler}
 */
function requireAuth(req, res, next) {
  if (!res.locals.isAuthenticated) {
    const redirect = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?redirect=${redirect}`);
  }
  return next();
}

/**
 * Admin guard — redirect to / if authenticated but not an admin.
 * Must be used AFTER requireAuth.
 *
 * @type {import('express').RequestHandler}
 */
function requireAdmin(req, res, next) {
  if (!res.locals.user || res.locals.user.role !== 'admin') {
    return res.status(403).render('pages/error', {
      title:           '403 Forbidden — Campus Marketplace',
      statusCode:      403,
      message:         'You do not have permission to access this page.',
      isAuthenticated: res.locals.isAuthenticated || false,
      user:            res.locals.user            || null,
      currentPath:     req.path,
    });
  }
  return next();
}

module.exports = { setLocals, requireAuth, requireAdmin };
