'use strict';

/**
 * src/services/report.service.js
 *
 * Business logic for product listing reports.
 *
 * Rules:
 *  - A user cannot report their own listing.
 *  - A user can only report the same listing once.
 *  - Report status management is admin-only (Phase 6).
 */

const Report  = require('../models/Report');
const Product = require('../models/Product');
const { NotFoundError, ConflictError, AppError } = require('../utils/errors');

/**
 * Creates a report for a product listing.
 *
 * @param {string} reportedBy  — ObjectId of the reporting user
 * @param {string} productId   — ObjectId of the product being reported
 * @param {{ reason: string, description?: string }} data
 * @returns {Promise<object>}
 * @throws {NotFoundError}   If the product does not exist.
 * @throws {AppError}        If the user is reporting their own listing.
 * @throws {ConflictError}   If the user has already reported this product.
 */
async function createReport(reportedBy, productId, data) {
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('Product');

  // Prevent self-reporting
  if (product.seller.equals(reportedBy)) {
    throw new AppError(
      'You cannot report your own listing.',
      400,
      'SELF_REPORT'
    );
  }

  // Enforce unique constraint at service level (DB index is the safety net)
  const existing = await Report.findOne({ product: productId, reportedBy });
  if (existing) {
    throw new ConflictError(
      'You have already submitted a report for this listing.',
      'DUPLICATE_REPORT'
    );
  }

  const report = await Report.create({
    product:     productId,
    reportedBy,
    reason:      data.reason,
    description: data.description || null,
  });

  return report;
}

/**
 * Returns a paginated list of reports (admin only).
 *
 * @param {{ status?: string, page?: number, limit?: number }} filters
 * @returns {Promise<{ reports: object[], pagination: object }>}
 */
async function getReports(filters = {}) {
  const { status, page = 1, limit = 20 } = filters;

  const filter = {};
  if (status) filter.status = status;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate('product',    'title status')
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Report.countDocuments(filter),
  ]);

  return {
    reports,
    pagination: {
      page:  pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}

module.exports = { createReport, getReports };
