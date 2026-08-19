'use strict';

/**
 * src/services/product.service.js
 *
 * Business logic for product listings.
 *
 * Layered architecture rules:
 *  - No access to req / res — only plain data in, plain data out.
 *  - Pagination capped at 50 items per page.
 *  - Field whitelisting prevents mass-assignment on updates.
 *  - Category existence and isActive status checked on create / update.
 */

const Product  = require('../models/Product');
const Category = require('../models/Category');
const { NotFoundError, AuthorizationError } = require('../utils/errors');

// Fields a seller may update on their own listing
const UPDATABLE_FIELDS = [
  'title', 'description', 'category',
  'price', 'condition', 'imageUrl',
  'location', 'isExchangeable',
];

// Seller fields to populate — do not expose email or passwordHash
const SELLER_PUBLIC_FIELDS  = 'name college phone profileImage';
const SELLER_SUMMARY_FIELDS = 'name college';
const CATEGORY_FIELDS       = 'name';

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

/**
 * Returns a populated single product document.
 * @param {string} id
 */
async function fetchPopulated(id) {
  return Product.findById(id)
    .populate('seller',   SELLER_PUBLIC_FIELDS)
    .populate('category', CATEGORY_FIELDS);
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Returns a paginated list of products matching the given filters.
 * Default filter: status = 'available'.
 *
 * Supported query params:
 *   q          — text search on title and description (regex, case-insensitive)
 *   category   — category ObjectId
 *   condition  — one of the condition enum values
 *   minPrice   — minimum price (inclusive)
 *   maxPrice   — maximum price (inclusive)
 *   page       — 1-indexed page number (default 1)
 *   limit      — items per page (default 20, max 50)
 *   sortBy     — 'createdAt' | 'price' (default 'createdAt')
 *   sortOrder  — 'asc' | 'desc' (default 'desc')
 *
 * @param {object} query
 * @returns {Promise<{ products: object[], pagination: object }>}
 */
async function getProducts(query = {}) {
  const {
    q,
    category,
    condition,
    minPrice,
    maxPrice,
    page      = 1,
    limit     = 20,
    sortBy    = 'createdAt',
    sortOrder = 'desc',
  } = query;

  // Only publicly visible products by default
  const filter = { status: 'available' };

  if (q && typeof q === 'string' && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title:       { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (category) filter.category = category;
  if (condition) filter.condition = condition;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && !Number.isNaN(parseFloat(minPrice))) {
      filter.price.$gte = parseFloat(minPrice);
    }
    if (maxPrice !== undefined && !Number.isNaN(parseFloat(maxPrice))) {
      filter.price.$lte = parseFloat(maxPrice);
    }
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const allowedSortFields = ['createdAt', 'price'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir   = sortOrder === 'asc' ? 1 : -1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('seller',   SELLER_SUMMARY_FIELDS)
      .populate('category', CATEGORY_FIELDS)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      page:  pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Returns a single product by ID with full seller and category details.
 * Accepts any status — let the caller decide whether to display status info.
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
async function getProductById(id) {
  const product = await fetchPopulated(id);
  if (!product) throw new NotFoundError('Product');
  return product;
}

/**
 * Returns all products listed by a specific seller (all statuses).
 * Used for the authenticated "my listings" endpoint.
 *
 * @param {string} sellerId
 * @returns {Promise<object[]>}
 */
async function getMyProducts(sellerId) {
  return Product.find({ seller: sellerId })
    .populate('category', CATEGORY_FIELDS)
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Creates a new product listing.
 * Validates that the referenced category exists and is active.
 *
 * @param {string} sellerId
 * @param {object} data
 * @returns {Promise<object>} Populated product document.
 * @throws {NotFoundError} If the category does not exist or is inactive.
 */
async function createProduct(sellerId, data) {
  const category = await Category.findById(data.category);
  if (!category || !category.isActive) {
    throw new NotFoundError('Category');
  }

  const product = await Product.create({
    title:          data.title,
    description:    data.description,
    category:       data.category,
    price:          data.price,
    condition:      data.condition,
    imageUrl:       data.imageUrl   || null,
    location:       data.location   || null,
    isExchangeable: data.isExchangeable || false,
    seller:         sellerId,
    status:         'available',
  });

  return fetchPopulated(product._id);
}

/**
 * Updates an existing product listing.
 * Only whitelisted fields are applied.
 * If category is being changed, validates the new category.
 *
 * @param {string} productId
 * @param {object} updates
 * @returns {Promise<object>} Updated populated product.
 * @throws {NotFoundError}
 */
async function updateProduct(productId, updates) {
  const safe = {};
  UPDATABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safe[field] = updates[field];
    }
  });

  if (safe.category) {
    const category = await Category.findById(safe.category);
    if (!category || !category.isActive) {
      throw new NotFoundError('Category');
    }
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: safe },
    { new: true, runValidators: true }
  );

  if (!product) throw new NotFoundError('Product');
  return fetchPopulated(product._id);
}

/**
 * Updates only the status field of a product.
 * Ownership is enforced in the route middleware — not here.
 *
 * @param {string} productId
 * @param {string} status
 * @returns {Promise<object>}
 */
async function updateProductStatus(productId, status) {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { status } },
    { new: true, runValidators: true }
  );

  if (!product) throw new NotFoundError('Product');
  return fetchPopulated(product._id);
}

/**
 * Permanently deletes a product listing.
 *
 * @param {string} productId
 * @throws {NotFoundError}
 */
async function deleteProduct(productId) {
  const product = await Product.findByIdAndDelete(productId);
  if (!product) throw new NotFoundError('Product');
}

module.exports = {
  getProducts,
  getProductById,
  getMyProducts,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
