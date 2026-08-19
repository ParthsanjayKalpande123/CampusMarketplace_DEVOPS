'use strict';

/**
 * src/routes/report.routes.js
 *
 * Report routes.
 *  POST /reports   — Auth required: submit a report.
 *  GET  /reports   — Admin only: list all reports.
 */

const { Router } = require('express');

const reportController = require('../controllers/report.controller');
const { createReportRules } = require('../validators/report.validator');
const { validate }    = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin }     = require('../middleware/admin.middleware');

const router = Router();

/**
 * POST /api/v1/reports
 * Auth required — submits a report for a product listing.
 * Body: { productId, reason, description? }
 */
router.post(
  '/',
  verifyToken,
  createReportRules,
  validate,
  reportController.create
);

/**
 * GET /api/v1/reports
 * Admin only — returns paginated reports.
 * Query: { status?, page?, limit? }
 */
router.get(
  '/',
  verifyToken,
  isAdmin,
  reportController.getAll
);

module.exports = router;
