'use strict';

/**
 * src/routes/category.routes.js
 *
 * Category routes.
 *  GET  /categories         — Public: returns active categories.
 *  POST /categories         — Admin only: creates a category.
 *  PATCH /categories/:id    — Admin only: updates a category (name, description, isActive).
 */

const { Router } = require('express');

const categoryController = require('../controllers/category.controller');
const { createCategoryRules, updateCategoryRules } = require('../validators/category.validator');
const { validate }    = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin }     = require('../middleware/admin.middleware');

const router = Router();

/**
 * GET /api/v1/categories
 * Public — returns alphabetically sorted active categories.
 */
router.get('/', categoryController.getAll);

/**
 * POST /api/v1/categories
 * Admin only — creates a new category.
 */
router.post(
  '/',
  verifyToken,
  isAdmin,
  createCategoryRules,
  validate,
  categoryController.create
);

/**
 * PATCH /api/v1/categories/:id
 * Admin only — updates name, description, or isActive status.
 */
router.patch(
  '/:id',
  verifyToken,
  isAdmin,
  updateCategoryRules,
  validate,
  categoryController.update
);

module.exports = router;
