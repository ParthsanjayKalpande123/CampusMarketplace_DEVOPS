'use strict';

/**
 * src/controllers/product.controller.js
 *
 * HTTP handlers for product listing endpoints.
 * Controllers call services and format HTTP responses — no business logic here.
 */

const productService = require('../services/product.service');
const apiResponse    = require('../utils/apiResponse');

/**
 * GET /api/v1/products
 * Public — returns paginated available listings.
 * Supports: q, category, condition, minPrice, maxPrice, page, limit, sortBy, sortOrder
 *
 * @type {import('express').RequestHandler}
 */
async function getAll(req, res, next) {
  try {
    const { products, pagination } = await productService.getProducts(req.query, req.user && req.user._id);
    return apiResponse.paginated(res, products, pagination, 'Products fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/products/my
 * Auth required — returns all listings by the authenticated seller (all statuses).
 *
 * @type {import('express').RequestHandler}
 */
async function getMy(req, res, next) {
  try {
    const products = await productService.getMyProducts(req.user._id);
    return apiResponse.success(res, { products }, 'Your listings fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/products/:id
 * Public — returns a single product with full seller and category details.
 *
 * @type {import('express').RequestHandler}
 */
async function getById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    return apiResponse.success(res, { product }, 'Product fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/products
 * Auth required — creates a new listing for the authenticated user.
 *
 * @type {import('express').RequestHandler}
 */
async function create(req, res, next) {
  try {
    const {
      title, description, category, price,
      condition, imageUrl, location, isExchangeable,
      listingType, details, pickupLocation, pickupAvailability, lostFoundDate,
      tags,
    } = req.body;

    const product = await productService.createProduct(req.user._id, {
      title, description, category, price,
      condition, imageUrl, location, isExchangeable,
      listingType, details, pickupLocation, pickupAvailability, lostFoundDate,
      tags,
    });

    return apiResponse.created(res, { product }, 'Listing created successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/v1/products/:id
 * Auth + ownership required — updates an existing listing.
 * req.resource is set by the loadProduct middleware in routes.
 *
 * @type {import('express').RequestHandler}
 */
async function update(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return apiResponse.success(res, { product }, 'Listing updated successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/products/:id/status
 * Auth + ownership required — updates only the status field.
 *
 * @type {import('express').RequestHandler}
 */
async function updateStatus(req, res, next) {
  try {
    const product = await productService.updateProductStatus(req.params.id, req.body.status);
    return apiResponse.success(res, { product }, 'Listing status updated successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/v1/products/:id
 * Auth + ownership required — permanently removes a listing.
 *
 * @type {import('express').RequestHandler}
 */
async function remove(req, res, next) {
  try {
    await productService.deleteProduct(req.params.id);
    return apiResponse.noContent(res);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAll, getMy, getById, create, update, updateStatus, remove };
