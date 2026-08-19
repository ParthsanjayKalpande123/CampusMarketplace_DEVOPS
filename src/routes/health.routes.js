'use strict';

/**
 * src/routes/health.routes.js
 *
 * Health and readiness check routes.
 * These routes have NO rate limiting and NO authentication
 * so Docker and Ansible can always probe them.
 */

const { Router } = require('express');
const { liveness, readiness } = require('../controllers/health.controller');

const router = Router();

/**
 * GET /api/v1/health
 * Liveness check — Node.js process is alive.
 */
router.get('/health', liveness);

/**
 * GET /api/v1/ready
 * Readiness check — all dependencies (MongoDB) are connected.
 */
router.get('/ready', readiness);

module.exports = router;
