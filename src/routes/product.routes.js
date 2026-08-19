'use strict';

/**
 * src/routes/product.routes.js
 *
 * Product listing routes.
 *
 * Route order matters:
 *  GET /my     — must be registered BEFORE GET /:id so 'my' is not parsed as an ID.
 *  GET /:id    — matched after /my
 *  PATCH /:id/status — two-segment path; no conflict with GET /:id
 *
 * Middleware chain for mutating routes:
 *   verifyToken → loadProduct → isOwner('seller') → [validate] → controller
 */

const { Router } = require('express');

const productController = require('../controllers/product.controller');
const {
  createProductRules,
  updateProductRules,
  updateStatusRules,
} = require('../validators/product.validator');
const { validate }                 = require('../middleware/validation.middleware');
const { verifyToken, optionalToken, isOwner } = require('../middleware/auth.middleware');
const { NotFoundError }            = require('../utils/errors');
const Product                      = require('../models/Product');

const router = Router();

// ------------------------------------------------------------------
// loadProduct — loads a product by :id and attaches it to req.resource.
// Used by ownership-protected routes so isOwner() can verify the seller.
// ------------------------------------------------------------------

async function loadProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new NotFoundError('Product'));
    req.resource = product;
    return next();
  } catch (err) {
    return next(err);
  }
}

// ------------------------------------------------------------------
// Public routes (no auth required)
// ------------------------------------------------------------------

/**
 * GET /api/v1/products
 * Returns paginated available listings.
 * Supports query: q, category, condition, minPrice, maxPrice,
 *                 page, limit, sortBy, sortOrder
 */
router.get('/', optionalToken, productController.getAll);

/**
 * GET /api/v1/products/my
 * Returns all listings by the authenticated seller (all statuses).
 * Registered before /:id to prevent 'my' being treated as a Mongo ID.
 */
router.get('/my', verifyToken, productController.getMy);

/**
 * GET /api/v1/products/:id
 * Returns a single product with full seller and category details.
 */
router.get('/:id', optionalToken, productController.getById);

// ------------------------------------------------------------------
// Authenticated routes
// ------------------------------------------------------------------

/**
 * POST /api/v1/products
 * Creates a new listing for the authenticated user.
 */
router.post(
  '/',
  verifyToken,
  createProductRules,
  validate,
  productController.create
);

// ------------------------------------------------------------------
// Authenticated + ownership routes
// ------------------------------------------------------------------

/**
 * PUT /api/v1/products/:id
 * Updates an existing listing. Seller only.
 */
router.put(
  '/:id',
  verifyToken,
  loadProduct,
  isOwner('seller'),
  updateProductRules,
  validate,
  productController.update
);

/**
 * PATCH /api/v1/products/:id/status
 * Updates only the status field. Seller only.
 */
router.patch(
  '/:id/status',
  verifyToken,
  loadProduct,
  isOwner('seller'),
  updateStatusRules,
  validate,
  productController.updateStatus
);

/**
 * DELETE /api/v1/products/:id
 * Permanently removes a listing. Seller only.
 */
router.delete(
  '/:id',
  verifyToken,
  loadProduct,
  isOwner('seller'),
  productController.remove
);

module.exports = router;
