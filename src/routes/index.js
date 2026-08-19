'use strict';

/**
 * src/routes/index.js
 *
 * Central router — mounts all API route modules under /api/v1.
 * app.js registers this router at '/api/v1'.
 *
 * Route modules are uncommented as each phase is implemented:
 *   Phase 2 — health routes
 *   Phase 3 — auth, user routes
 *   Phase 4 — product, category, report routes (active now)
 *   Phase 6 — admin routes
 */

const { Router } = require('express');

const healthRoutes   = require('./health.routes');
const authRoutes     = require('./auth.routes');
const userRoutes     = require('./user.routes');
const productRoutes  = require('./product.routes');
const categoryRoutes = require('./category.routes');
const reportRoutes   = require('./report.routes');
const adminRoutes    = require('./admin.routes');

const router = Router();

// System health
router.use('/', healthRoutes);

// Phase 3 — Authentication + User profile
router.use('/auth',  authRoutes);
router.use('/users', userRoutes);

// Phase 4 — Marketplace
router.use('/products',   productRoutes);
router.use('/categories', categoryRoutes);
router.use('/reports',    reportRoutes);

// Phase 6 — Admin
router.use('/admin', adminRoutes);

module.exports = router;
