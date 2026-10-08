'use strict';

/**
 * src/services/admin.service.js
 *
 * Business logic for admin-only operations.
 *
 * Admin scope:
 *  - Dashboard stats aggregate
 *  - User management (list, role change)
 *  - Report status management
 *  - Product oversight (list all, force-remove)
 */

const User    = require('../models/User');
const Product = require('../models/Product');
const Report  = require('../models/Report');
const { NotFoundError, AppError } = require('../utils/errors');
const CampusRecord = require('../models/CampusRecord');

// ------------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------------

/**
 * Returns aggregate counts and the 5 most recent products and users.
 * Used to populate the admin dashboard.
 *
 * @returns {Promise<object>}
 */
async function getStats() {
  const [
    totalUsers,
    totalProducts,
    availableProducts,
    totalReports,
    pendingReports,
    recentProducts,
    recentUsers,
    recentReports,
    listingsByLocation,
    flaggedListings,
  ] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    Product.countDocuments({ status: 'available' }),
    Report.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
    Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('seller',   'name')
      .populate('category', 'name')
      .lean(),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('-passwordHash')
      .lean(),
    Report.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('product', 'title status location')
      .populate('reportedBy', 'name email')
      .lean(),
    Product.aggregate([
      { $group: { _id: { $ifNull: ['$location', 'Unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    Product.find({ aiReviewStatus: 'pending-review' })
      .populate('seller', 'name college').populate('category', 'name')
      .sort({ updatedAt: -1 }).limit(10).lean(),
  ]);

  return {
    totalUsers,
    totalProducts,
    availableProducts,
    totalReports,
    pendingReports,
    recentProducts,
    recentUsers,
    recentReports,
    listingsByLocation,
    flaggedListings,
  };
}

async function createProduct(adminId, data) {
  const Category = require('../models/Category');
  const category = await Category.findById(data.category);
  if (!category || !category.isActive) throw new NotFoundError('Category');

  return Product.create({
    title: data.title,
    description: data.description,
    category: data.category,
    price: data.price,
    condition: data.condition,
    imageUrl: data.imageUrl || null,
    location: data.location || null,
    isExchangeable: data.isExchangeable || false,
    seller: adminId,
    status: 'available',
  });
}

// ------------------------------------------------------------------
// User management
// ------------------------------------------------------------------

/**
 * Returns a paginated list of all users.
 * Optional text search on name and email.
 *
 * @param {{ q?: string, role?: string, page?: number, limit?: number }} query
 * @returns {Promise<{ users: object[], pagination: object }>}
 */
async function getUsers(query = {}) {
  const { q, role, page = 1, limit = 20 } = query;

  const filter = {};
  if (q && typeof q === 'string' && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name:  { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }
  if (role) filter.role = role;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  };
}

/**
 * Changes a user's role.
 * Prevents an admin from demoting themselves.
 *
 * @param {string} userId
 * @param {string} role        — 'student' | 'admin'
 * @param {string} requesterId — the admin performing the action
 * @returns {Promise<object>}
 * @throws {AppError} If trying to change own role.
 * @throws {NotFoundError}
 */
async function updateUserRole(userId, role, requesterId) {
  if (userId === requesterId.toString()) {
    throw new AppError('You cannot change your own role.', 400, 'SELF_ROLE_CHANGE');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { role } },
    { new: true, runValidators: true }
  ).select('-passwordHash');

  if (!user) throw new NotFoundError('User');
  return user;
}

// ------------------------------------------------------------------
// Report management
// ------------------------------------------------------------------

/**
 * Updates the status of a report (reviewed | resolved).
 *
 * @param {string} reportId
 * @param {string} status
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
async function updateReportStatus(reportId, status) {
  const report = await Report.findByIdAndUpdate(
    reportId,
    { $set: { status } },
    { new: true }
  )
    .populate('product',    'title status')
    .populate('reportedSeller', 'name')
    .populate('reportedBy', 'name email');

  if (!report) throw new NotFoundError('Report');
  await CampusRecord.create({
    owner: report.reportedBy._id,
    type: 'notification',
    product: report.product ? report.product._id : null,
    content: `Your ${report.targetType} report was marked ${status}.`,
  });
  return report;
}

// ------------------------------------------------------------------
// Product oversight
// ------------------------------------------------------------------

/**
 * Returns a paginated list of ALL products (all sellers, all statuses).
 *
 * @param {{ q?: string, status?: string, page?: number, limit?: number }} query
 * @returns {Promise<{ products: object[], pagination: object }>}
 */
async function getAllProducts(query = {}) {
  const { q, status, page = 1, limit = 20 } = query;

  const filter = {};
  if (q && typeof q === 'string' && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.title  = { $regex: escaped, $options: 'i' };
  }
  if (status) filter.status = status;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('seller',   'name email')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  };
}

/**
 * Hides a product listing from the marketplace while retaining it so the
 * seller can see that it was removed by an administrator.
 *
 * @param {string} productId
 * @throws {NotFoundError}
 */
async function removeProduct(productId) {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { status: 'removed' } },
    { new: true, runValidators: true }
  );
  if (!product) throw new NotFoundError('Product');
}

module.exports = {
  getStats,
  getUsers,
  updateUserRole,
  updateReportStatus,
  getAllProducts,
  removeProduct,
  createProduct,
};
