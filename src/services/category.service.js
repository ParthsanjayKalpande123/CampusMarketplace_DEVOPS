'use strict';

/**
 * src/services/category.service.js
 *
 * Business logic for product categories.
 *
 * seedDefaultCategories() is called once at server startup to ensure
 * the categories collection is never empty.
 */

const Category = require('../models/Category');
const logger   = require('../utils/logger');
const { NotFoundError, ConflictError } = require('../utils/errors');

/** Categories seeded on first startup if the collection is empty. */
const DEFAULT_CATEGORIES = [
  { name: 'Books & Notes',       description: 'Textbooks, reference books, notes, and study material.' },
  { name: 'Electronics',         description: 'Laptops, phones, calculators, chargers, and gadgets.' },
  { name: 'Lab Equipment',       description: 'Lab tools, instruments, sensors, and measurement devices.' },
  { name: 'Furniture',           description: 'Chairs, tables, shelves, storage racks, and lamps.' },
  { name: 'Bags & Stationery',   description: 'Backpacks, pens, notebooks, files, and accessories.' },
  { name: 'Cycles & Transport',  description: 'Bicycles, scooters, helmets, and vehicle accessories.' },
  { name: 'Project Components',  description: 'Electronic components, Arduino kits, 3D print material, and tools.' },
  { name: 'Sports & Fitness',    description: 'Sports equipment, gym gear, and outdoor accessories.' },
  { name: 'Other',               description: 'Miscellaneous items that do not fit other categories.' },
];

/**
 * Returns all active categories.
 * Used by the public-facing category listing endpoint.
 *
 * @returns {Promise<object[]>}
 */
async function getActiveCategories() {
  return Category.find({ isActive: true }).sort({ name: 1 }).lean();
}

/**
 * Returns all categories including inactive ones.
 * Used by admin endpoints only.
 *
 * @returns {Promise<object[]>}
 */
async function getAllCategories() {
  return Category.find({}).sort({ name: 1 }).lean();
}

/**
 * Creates a new category.
 *
 * @param {{ name: string, description?: string }} data
 * @returns {Promise<object>}
 * @throws {ConflictError} If name already exists (case-insensitive via schema lowercase).
 */
async function createCategory(data) {
  try {
    const category = await Category.create({
      name:        data.name,
      description: data.description || null,
    });
    return category;
  } catch (err) {
    if (err.code === 11000) {
      throw new ConflictError(
        'A category with this name already exists.',
        'DUPLICATE_CATEGORY'
      );
    }
    throw err;
  }
}

/**
 * Updates a category (admin only).
 *
 * @param {string} categoryId
 * @param {{ name?: string, description?: string, isActive?: boolean }} updates
 * @returns {Promise<object>}
 * @throws {NotFoundError}
 */
async function updateCategory(categoryId, updates) {
  const allowed = ['name', 'description', 'isActive'];
  const safe = {};
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safe[field] = updates[field];
    }
  });

  const category = await Category.findByIdAndUpdate(
    categoryId,
    { $set: safe },
    { new: true, runValidators: true }
  );

  if (!category) throw new NotFoundError('Category');
  return category;
}

/**
 * Seeds default categories on first startup.
 * No-op if any categories already exist.
 *
 * @returns {Promise<void>}
 */
async function seedDefaultCategories() {
  const count = await Category.countDocuments();
  if (count > 0) {
    logger.info('Category seeding skipped — categories already exist', { count });
    return;
  }

  await Category.insertMany(DEFAULT_CATEGORIES);
  logger.info('Default categories seeded', { count: DEFAULT_CATEGORIES.length });
}

module.exports = {
  getActiveCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  seedDefaultCategories,
};
