'use strict';

/**
 * src/routes/views.routes.js
 *
 * EJS view routes — server-side rendered pages.
 * All routes call the service layer directly (no internal HTTP calls).
 *
 * Route map:
 *   GET /                  — Marketplace home (product listing + filters)
 *   GET /listings/:id      — Product detail page
 *   GET /login             — Login page (redirect to / if already auth'd)
 *   GET /register          — Register page (redirect to / if already auth'd)
 *   GET /post              — Create listing form (auth required)
 *   GET /listings/:id/edit — Edit listing form  (auth + ownership required)
 *   GET /my-listings       — Seller's own listings (auth required)
 *   GET /profile           — User profile page  (auth required)
 */

const { Router }  = require('express');
const mongoose    = require('mongoose');

const { setLocals, requireAuth, requireAdmin } = require('../middleware/view.auth.middleware');
const productService  = require('../services/product.service');
const categoryService = require('../services/category.service');
const adminService    = require('../services/admin.service');
const reportService   = require('../services/report.service');
const messageService  = require('../services/message.service');
const User            = require('../models/User');
const { NotFoundError, AuthorizationError } = require('../utils/errors');

const router = Router();

// Apply soft auth to every view route
router.use(setLocals);

// ------------------------------------------------------------------
// GET / — Marketplace home
// ------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { products, pagination } = await productService.getProducts(req.query);
    const categories = await categoryService.getActiveCategories();

    return res.render('pages/index', {
      title: 'Campus Marketplace — Buy, Sell & Exchange on Campus',
      products,
      pagination,
      categories,
      query: req.query,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /login — Login page
// ------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (res.locals.isAuthenticated) return res.redirect('/');
  return res.render('pages/login', {
    title: 'Login — Campus Marketplace',
    redirect: req.query.redirect || '/',
  });
});

// ------------------------------------------------------------------
// GET /register — Register page
// ------------------------------------------------------------------
router.get('/register', (req, res) => {
  if (res.locals.isAuthenticated) return res.redirect('/');
  return res.render('pages/register', {
    title: 'Create Account — Campus Marketplace',
  });
});

// ------------------------------------------------------------------
// GET /post — Create listing form (auth required)
// ------------------------------------------------------------------
router.get('/post', requireAuth, async (req, res, next) => {
  try {
    const categories = await categoryService.getActiveCategories();
    return res.render('pages/post-listing', {
      title: 'Post a Listing — Campus Marketplace',
      categories,
      product: null, // null signals "create" mode to the template
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /my-listings — Seller's own listings (auth required)
// ------------------------------------------------------------------
router.get('/my-listings', requireAuth, async (req, res, next) => {
  try {
    const products = await productService.getMyProducts(req.user._id);
    return res.render('pages/my-listings', {
      title: 'My Listings — Campus Marketplace',
      products,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /profile — User profile (auth required)
// ------------------------------------------------------------------
router.get('/profile', requireAuth, (req, res) => {
  return res.render('pages/profile', {
    title: 'My Profile — Campus Marketplace',
  });
});

// ------------------------------------------------------------------
// GET /inbox — In-App Chat Dashboard (auth required)
// ------------------------------------------------------------------
router.get('/inbox', requireAuth, async (req, res, next) => {
  try {
    const conversations = await messageService.getConversations(req.user._id);
    let activeChatUser = null;
    let activeProduct  = null;
    let messages       = [];

    const { userId, productId } = req.query;

    if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        activeChatUser = await User.findById(userId).lean();
      }
      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        activeProduct = await productService.getProductById(productId);
      }
      if (activeChatUser) {
        messages = await messageService.getChatHistory(req.user._id, userId);
      }
    }

    return res.render('pages/inbox', {
      title: 'Inbox — Campus Marketplace',
      conversations,
      activeChatUser,
      activeProduct,
      messages,
      query: req.query,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /listings/:id — Product detail page (public)
// ------------------------------------------------------------------
router.get('/listings/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new NotFoundError('Product'));
    }

    const product    = await productService.getProductById(req.params.id);
    const categories = await categoryService.getActiveCategories();

    // Determine if current user is the seller
    const isOwner = res.locals.isAuthenticated &&
      product.seller._id.toString() === res.locals.user._id.toString();

    return res.render('pages/product', {
      title: `${product.title} — Campus Marketplace`,
      product,
      categories,
      isOwner,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /listings/:id/edit — Edit listing form (auth + ownership)
// ------------------------------------------------------------------
router.get('/listings/:id/edit', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new NotFoundError('Product'));
    }

    const product    = await productService.getProductById(req.params.id);
    const categories = await categoryService.getActiveCategories();

    // Ownership check for the view route
    if (product.seller._id.toString() !== req.user._id.toString()) {
      return next(new AuthorizationError());
    }

    return res.render('pages/post-listing', {
      title: `Edit Listing — Campus Marketplace`,
      categories,
      product, // non-null signals "edit" mode to the template
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

// ==================================================================
// ADMIN VIEW ROUTES — require auth + admin role
// All routes below apply: setLocals (already applied) → requireAuth → requireAdmin
// ==================================================================

// Convenience redirect: /admin → /admin/dashboard
router.get('/admin', requireAuth, requireAdmin, (req, res) => res.redirect('/admin/dashboard'));

// ------------------------------------------------------------------
// GET /admin/dashboard
// ------------------------------------------------------------------
router.get('/admin/dashboard', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [stats, categories] = await Promise.all([
      adminService.getStats(),
      categoryService.getActiveCategories(),
    ]);
    return res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard — Campus Marketplace',
      stats,
      categories,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /admin/users
// ------------------------------------------------------------------
router.get('/admin/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users, pagination } = await adminService.getUsers(req.query);
    return res.render('pages/admin/users', {
      title:      'Manage Users — Campus Marketplace',
      users,
      pagination,
      query:      req.query,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /admin/reports
// ------------------------------------------------------------------
router.get('/admin/reports', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { reports, pagination } = await reportService.getReports(req.query);
    return res.render('pages/admin/reports', {
      title:      'Manage Reports — Campus Marketplace',
      reports,
      pagination,
      query:      req.query,
    });
  } catch (err) {
    return next(err);
  }
});
