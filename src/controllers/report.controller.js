'use strict';

/**
 * src/controllers/report.controller.js
 *
 * HTTP handlers for product report endpoints.
 */

const reportService = require('../services/report.service');
const apiResponse   = require('../utils/apiResponse');

/**
 * POST /api/v1/reports
 * Auth required — reports a product listing.
 * Body: { productId, reason, description? }
 *
 * @type {import('express').RequestHandler}
 */
async function create(req, res, next) {
  try {
    const { productId, reason, description } = req.body;
    const report = await reportService.createReport(
      req.user._id,
      productId,
      { reason, description }
    );
    return apiResponse.created(res, { report }, 'Report submitted successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/reports
 * Admin only — returns paginated reports with optional status filter.
 * Query: { status?, page?, limit? }
 *
 * @type {import('express').RequestHandler}
 */
async function getAll(req, res, next) {
  try {
    const { reports, pagination } = await reportService.getReports(req.query);
    return apiResponse.paginated(res, reports, pagination, 'Reports fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, getAll };
