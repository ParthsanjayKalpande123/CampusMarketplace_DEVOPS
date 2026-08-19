'use strict';

/**
 * src/controllers/admin.controller.js
 *
 * HTTP handlers for admin-only endpoints.
 * All routes require verifyToken + isAdmin (enforced in admin.routes.js).
 */

const adminService  = require('../services/admin.service');
const reportService = require('../services/report.service');
const apiResponse   = require('../utils/apiResponse');

/* ---- Dashboard ---------------------------------------------------- */

/**
 * GET /api/v1/admin/stats
 * @type {import('express').RequestHandler}
 */
async function getStats(req, res, next) {
  try {
    const stats = await adminService.getStats();
    return apiResponse.success(res, stats, 'Stats fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/* ---- Users --------------------------------------------------------- */

/**
 * GET /api/v1/admin/users
 * Query: q, role, page, limit
 * @type {import('express').RequestHandler}
 */
async function getUsers(req, res, next) {
  try {
    const { users, pagination } = await adminService.getUsers(req.query);
    return apiResponse.paginated(res, users, pagination, 'Users fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/admin/users/:id/role
 * Body: { role }
 * @type {import('express').RequestHandler}
 */
async function updateUserRole(req, res, next) {
  try {
    const user = await adminService.updateUserRole(req.params.id, req.body.role, req.user._id);
    return apiResponse.success(res, { user }, 'User role updated successfully.');
  } catch (err) {
    return next(err);
  }
}

/* ---- Reports ------------------------------------------------------- */

/**
 * GET /api/v1/admin/reports
 * Query: status, page, limit
 * @type {import('express').RequestHandler}
 */
async function getReports(req, res, next) {
  try {
    const { reports, pagination } = await reportService.getReports(req.query);
    return apiResponse.paginated(res, reports, pagination, 'Reports fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/admin/reports/:id/status
 * Body: { status }
 * @type {import('express').RequestHandler}
 */
async function updateReportStatus(req, res, next) {
  try {
    const report = await adminService.updateReportStatus(req.params.id, req.body.status);
    return apiResponse.success(res, { report }, 'Report status updated successfully.');
  } catch (err) {
    return next(err);
  }
}

/* ---- Products ------------------------------------------------------ */

/**
 * GET /api/v1/admin/products
 * Query: q, status, page, limit
 * @type {import('express').RequestHandler}
 */
async function getProducts(req, res, next) {
  try {
    const { products, pagination } = await adminService.getAllProducts(req.query);
    return apiResponse.paginated(res, products, pagination, 'Products fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/v1/admin/products/:id
 * Admin force-removes a listing regardless of seller.
 * @type {import('express').RequestHandler}
 */
async function removeProduct(req, res, next) {
  try {
    await adminService.removeProduct(req.params.id);
    return apiResponse.noContent(res);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getStats, getUsers, updateUserRole, getReports, updateReportStatus, getProducts, removeProduct };
