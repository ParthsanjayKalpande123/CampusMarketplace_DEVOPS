'use strict';

/**
 * src/controllers/health.controller.js
 *
 * Liveness and readiness check controllers.
 *
 * liveness  — Is the Node.js process alive?
 *             Does NOT check MongoDB. Used by Docker HEALTHCHECK.
 *
 * readiness — Are all required dependencies ready?
 *             Checks MongoDB connection state.
 *             Returns 503 if MongoDB is not connected.
 *             Used by Ansible post-deploy verification and monitoring.
 */

const { getDatabaseStatus, isConnected } = require('../config/database');
const { config } = require('../config/env');

/**
 * GET /api/v1/health
 * Liveness probe — always returns 200 if the process is running.
 *
 * @type {import('express').RequestHandler}
 */
function liveness(req, res) {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    service: config.app.name,
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/ready
 * Readiness probe — returns 200 only when MongoDB is connected.
 * Returns 503 (Service Unavailable) when dependencies are not ready.
 *
 * @type {import('express').RequestHandler}
 */
function readiness(req, res) {
  const dbConnected = isConnected();
  const dbStatus = getDatabaseStatus();

  const statusCode = dbConnected ? 200 : 503;

  return res.status(statusCode).json({
    success: dbConnected,
    status: dbConnected ? 'ready' : 'not_ready',
    checks: {
      mongodb: dbStatus,
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { liveness, readiness };
