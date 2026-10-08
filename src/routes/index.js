'use strict';

/**
 * src/routes/index.js
 *
 * Central router — mounts all API route modules under /api/v1.
 * app.js registers this router at '/api/v1'.
 *
 * Each application route group is mounted under its API prefix below.
 */

const { Router } = require('express');

const healthRoutes   = require('./health.routes');
const authRoutes     = require('./auth.routes');
const userRoutes     = require('./user.routes');
const productRoutes  = require('./product.routes');
const categoryRoutes = require('./category.routes');
const reportRoutes   = require('./report.routes');
const adminRoutes    = require('./admin.routes');
const messageRoutes  = require('./message.routes');
const campusFeatureRoutes = require('./campus-feature.routes');

const router = Router();

// System health
router.use('/', healthRoutes);

// Authentication + user profile
router.use('/auth',  authRoutes);
router.use('/users', userRoutes);

// Marketplace
router.use('/products',   productRoutes);
router.use('/categories', categoryRoutes);
router.use('/reports',    reportRoutes);

// Messaging
router.use('/messages', messageRoutes);
router.use('/features', campusFeatureRoutes);

// Admin
router.use('/admin', adminRoutes);

module.exports = router;
