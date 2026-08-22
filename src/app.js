'use strict';

/**
 * src/app.js
 *
 * Express application factory.
 * Configures all middleware and mounts all routers.
 * Exported as a module so it can be imported in tests without
 * starting the HTTP server.
 *
 * Middleware order (MUST be preserved):
 *  1. Security headers (Helmet)
 *  2. CORS
 *  3. Body parsers + cookie parser
 *  4. Request logger (Morgan → Winston)
 *  5. Global rate limiter
 *  6. View engine + static assets
 *  7. View routes  (EJS pages at /)
 *  8. API routes   (JSON at /api/v1)
 *  9. 404 handler
 * 10. Global error handler  ← must be last
 */

const express = require('express');
const path    = require('path');
const helmet  = require('helmet');
const cors    = require('cors');
const cookieParser  = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const { config }       = require('./config/env');
const requestLogger    = require('./middleware/logger.middleware');
const errorMiddleware  = require('./middleware/error.middleware');
const { NotFoundError } = require('./utils/errors');
const apiRoutes        = require('./routes/index');
const viewRoutes       = require('./routes/views.routes');

const app = express();

// ------------------------------------------------------------------
// 1. Security headers via Helmet
// ------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        // Bootstrap 5 + Google Fonts (CDN)
        styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        scriptSrc:   ["'self'", 'https://cdn.jsdelivr.net'],
        fontSrc:     ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:', 'https:'],
        connectSrc:  ["'self'"],
        upgradeInsecureRequests: config.cookie.secure ? [] : null,
      },
    },
    hsts: config.cookie.secure,
    crossOriginEmbedderPolicy: false,
  })
);

// ------------------------------------------------------------------
// 2. CORS — credentials: true required for HTTP-only cookie
// ------------------------------------------------------------------
app.use(
  cors({
    origin:         config.cors.origin,
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  })
);

// ------------------------------------------------------------------
// 3. Body parsers + cookie parser
// ------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ------------------------------------------------------------------
// 4. HTTP request logger (Morgan → Winston)
// ------------------------------------------------------------------
app.use(requestLogger);

// ------------------------------------------------------------------
// 5. Global rate limiter
// ------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            300,
  standardHeaders: true,
  legacyHeaders:  false,
  skip:           (req) => config.isTest ||
                           req.path === '/api/v1/health' ||
                           req.path === '/api/v1/ready',
  message: {
    success: false,
    error: {
      code:    'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
    },
  },
});

app.use(globalLimiter);

// ------------------------------------------------------------------
// 6. View engine (EJS) + static assets
// ------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, '..', 'public')));

// ------------------------------------------------------------------
// 7. EJS view routes (served at /)
// ------------------------------------------------------------------
app.use('/', viewRoutes);

// ------------------------------------------------------------------
// 8. API routes (served at /api/v1)
// ------------------------------------------------------------------
app.use('/api/v1', apiRoutes);

// ------------------------------------------------------------------
// 9. 404 handler
//    API misses  → JSON  (passed to error middleware as NotFoundError)
//    Page misses → EJS 404 page
// ------------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
    });
  }
  return res.status(404).render('pages/error', {
    title:           '404 Not Found — Campus Marketplace',
    statusCode:      404,
    message:         'The page you are looking for does not exist.',
    isAuthenticated: res.locals.isAuthenticated || false,
    user:            res.locals.user            || null,
    currentPath:     req.path,
  });
});

// ------------------------------------------------------------------
// 10. Global error handler — MUST be registered last
// ------------------------------------------------------------------
app.use(errorMiddleware);

module.exports = app;
