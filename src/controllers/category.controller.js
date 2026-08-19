'use strict';

/**
 * src/controllers/category.controller.js
 *
 * HTTP handlers for category endpoints.
 */

const categoryService = require('../services/category.service');
const apiResponse     = require('../utils/apiResponse');

/**
 * GET /api/v1/categories
 * Public — returns active categories sorted alphabetically.
 *
 * @type {import('express').RequestHandler}
 */
async function getAll(req, res, next) {
  try {
    const categories = await categoryService.getActiveCategories();
    return apiResponse.success(res, { categories }, 'Categories fetched successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/categories
 * Admin only — creates a new category.
 *
 * @type {import('express').RequestHandler}
 */
async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    const category = await categoryService.createCategory({ name, description });
    return apiResponse.created(res, { category }, 'Category created successfully.');
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/categories/:id
 * Admin only — updates a category (name, description, or isActive flag).
 *
 * @type {import('express').RequestHandler}
 */
async function update(req, res, next) {
  try {
    const { name, description, isActive } = req.body;
    const category = await categoryService.updateCategory(req.params.id, {
      name, description, isActive,
    });
    return apiResponse.success(res, { category }, 'Category updated successfully.');
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAll, create, update };
