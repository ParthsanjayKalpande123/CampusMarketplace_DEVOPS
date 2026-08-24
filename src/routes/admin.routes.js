'use strict';

/**
 * src/routes/admin.routes.js
 *
 * Admin-only API routes.
 * All routes require: verifyToken → isAdmin → handler.
 *
 * Route map:
 *   GET    /api/v1/admin/stats                — dashboard aggregates
 *   GET    /api/v1/admin/users                — paginated user list
 *   PATCH  /api/v1/admin/users/:id/role       — change user role
 *   GET    /api/v1/admin/reports              — paginated reports
 *   PATCH  /api/v1/admin/reports/:id/status   — update report status
 *   GET    /api/v1/admin/products             — all products (oversight)
 *   DELETE /api/v1/admin/products/:id         — force-remove a product
 */

const { Router } = require('express');

const adminController = require('../controllers/admin.controller');
const {
  updateRoleRules,
  updateReportStatusRules,
} = require('../validators/admin.validator');
const { validate }    = require('../middleware/validation.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin }     = require('../middleware/admin.middleware');
const { createProductRules } = require('../validators/product.validator');

const router = Router();

// Every admin route requires authentication + admin role
router.use(verifyToken, isAdmin);

/* ---- Dashboard ---------------------------------------------------- */
router.get('/stats', adminController.getStats);

/* ---- Users --------------------------------------------------------- */
router.get('/users', adminController.getUsers);

router.patch(
  '/users/:id/role',
  updateRoleRules,
  validate,
  adminController.updateUserRole
);

/* ---- Reports ------------------------------------------------------- */
router.get('/reports', adminController.getReports);

router.patch(
  '/reports/:id/status',
  updateReportStatusRules,
  validate,
  adminController.updateReportStatus
);

/* ---- Products ------------------------------------------------------ */
router.get('/products', adminController.getProducts);
router.post('/products', createProductRules, validate, adminController.createProduct);
router.delete('/products/:id', adminController.removeProduct);

module.exports = router;
