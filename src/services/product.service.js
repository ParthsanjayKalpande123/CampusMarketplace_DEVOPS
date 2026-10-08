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
const CampusRecord = require('../models/CampusRecord');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const campusFeatures = require('./campus-feature.service');

// Fields a seller may update on their own listing
const UPDATABLE_FIELDS = [
  'title', 'description', 'category',
  'price', 'condition', 'imageUrl',
  'location', 'isExchangeable', 'listingType', 'details',
  'pickupLocation', 'pickupAvailability', 'lostFoundDate', 'tags',
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
async function getProducts(query = {}, viewerId = null) {
  await campusFeatures.releaseExpiredReservations();
  const {
    q,
    category,
    condition,
    minPrice,
    maxPrice,
    college,
    listingType,
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
  if (listingType && ['sale', 'free', 'lost', 'found'].includes(listingType)) filter.listingType = listingType;

  if (college && typeof college === 'string' && college.trim()) {
    const escapedCollege = college.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const User = require('../models/User');
    const sellers = await User.find({ college: { $regex: escapedCollege, $options: 'i' } }).select('_id');
    const sellerIds = sellers.map(s => s._id);
    filter.seller = { $in: sellerIds };
  }
  if (viewerId) {
    const hiddenIds = await campusFeatures.getHiddenUserIds(viewerId);
    if (hiddenIds.length) {
      filter.$and = [...(filter.$and || []), { seller: { $nin: hiddenIds } }];
    }
  }

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

  const listingType = data.listingType || (Number(data.price) === 0 ? 'free' : 'sale');
  if (['free', 'lost', 'found'].includes(listingType) && Number(data.price) !== 0) {
    throw new ValidationError('Free, lost, and found listings must have a price of 0.');
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
    listingType,
    details: data.details || {},
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
    pickupLocation: data.pickupLocation || null,
    pickupAvailability: data.pickupAvailability || null,
    lostFoundDate: data.lostFoundDate || null,
    seller:         sellerId,
    status:         'available',
  });

  await campusFeatures.findSearchMatches(product);
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
  const current = await Product.findById(productId).select('price listingType');
  if (!current) throw new NotFoundError('Product');
  const safe = {};
  UPDATABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safe[field] = updates[field];
    }
  });

  if (safe.listingType && ['free', 'lost', 'found'].includes(safe.listingType)) {
    safe.price = 0;
  } else if (safe.price === 0 && (!safe.listingType || safe.listingType === 'sale')) {
    safe.listingType = 'free';
  }
  const effectiveType = safe.listingType || current.listingType;
  const effectivePrice = safe.price === undefined ? current.price : Number(safe.price);
  if (['free', 'lost', 'found'].includes(effectiveType) && effectivePrice !== 0) {
    throw new ValidationError('Free, lost, and found listings must have a price of 0.');
  }

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
  if (safe.price !== undefined && safe.price < current.price) {
    await campusFeatures.notifyPriceDrop(product._id, current.price, safe.price);
  }
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
  const current = await Product.findById(productId).select('status');
  if (!current) throw new NotFoundError('Product');
  if (current.status === 'reserved') {
    throw new ConflictError('A reserved listing can only be released by cancelling or expiring its order.');
  }
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { status } },
    { new: true, runValidators: true }
  );

  if (!product) throw new NotFoundError('Product');
  if (status === 'sold' || status === 'exchanged') {
    const watchers = await CampusRecord.find({ type: 'wishlist', product: productId }).select('owner').lean();
    for (const watcher of watchers) {
      await campusFeatures.notify(watcher.owner, 'A listing on your wishlist is no longer available.', productId);
    }
    await CampusRecord.deleteMany({ type: 'wishlist', product: productId });
  }
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
