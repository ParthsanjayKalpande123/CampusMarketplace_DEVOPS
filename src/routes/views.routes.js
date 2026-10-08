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
const campusFeatures  = require('../services/campus-feature.service');
const User            = require('../models/User');
const Product         = require('../models/Product');
const { NotFoundError, AuthorizationError } = require('../utils/errors');

const router = Router();

// Apply soft auth to every view route
router.use(setLocals);

// ------------------------------------------------------------------
// GET / — Marketplace home
// ------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { products, pagination } = await productService.getProducts(req.query, req.user && req.user._id);
    const categories = await categoryService.getActiveCategories();
    let recommendations = [];
    if (req.user && !req.query.q && !req.query.category) {
      const account = await User.findById(req.user._id).select('interests');
      if (account.interests.length) {
        const hiddenSellerIds = await campusFeatures.getHiddenUserIds(req.user._id);
        recommendations = await Product.find({
          category: { $in: account.interests },
          status: 'available',
          seller: { $nin: hiddenSellerIds },
        }).populate('seller', 'name college collegeVerified').populate('category', 'name')
          .sort({ createdAt: -1 }).limit(4).lean();
      }
    }

    return res.render('pages/index', {
      title: 'Campus Marketplace — Buy, Sell & Exchange on Campus',
      products,
      pagination,
      categories,
      query: req.query,
      recommendations,
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
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const profileStats = await campusFeatures.getProfileStats(req.user._id);
    return res.render('pages/profile', {
      title: 'My Profile — Campus Marketplace',
      profileStats,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/account/features', requireAuth, async (req, res, next) => {
  try {
    const [wishlist, recentlyViewed, savedSearches, notifications, offers, orders, categories, interests, blocks] = await Promise.all([
      campusFeatures.getWishlist(req.user._id),
      campusFeatures.getRecentlyViewed(req.user._id),
      campusFeatures.getRecords(req.user._id, 'saved-search'),
      campusFeatures.getNotifications(req.user._id),
      campusFeatures.getOffers(req.user._id),
      campusFeatures.getOrders(req.user._id),
      categoryService.getActiveCategories(),
      User.findById(req.user._id).populate('interests', 'name').lean().then((account) => account.interests || []),
      campusFeatures.getBlocks(req.user._id),
    ]);
    const compareIds = String(req.query.compare || '').split(',').filter((id) => mongoose.Types.ObjectId.isValid(id)).slice(0, 4);
    const hiddenSellerIds = await campusFeatures.getHiddenUserIds(req.user._id);
    const compareProducts = compareIds.length >= 2
      ? await Product.find({ _id: { $in: compareIds }, status: 'available', seller: { $nin: hiddenSellerIds } })
        .populate('seller', 'name college collegeVerified').populate('category', 'name').lean()
      : [];
    const compareRatings = await Promise.all(compareProducts.map((item) => campusFeatures.getSellerRating(item.seller._id)));
    return res.render('pages/account-features', {
      title: 'My Marketplace — Campus Marketplace',
      wishlist, recentlyViewed, savedSearches, notifications, offers, orders, categories, interests, blocks,
      compareProducts: compareProducts.map((item, index) => ({ ...item, sellerRating: compareRatings[index] })),
    });
  } catch (err) {
    return next(err);
  }
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
    if (req.user && await campusFeatures.isBlocked(req.user._id, product.seller._id)) {
      return next(new NotFoundError('Product'));
    }
    const categories = await categoryService.getActiveCategories();
    if (req.user) await campusFeatures.addRecentlyViewed(req.user._id, product._id);
    const isOwner = res.locals.isAuthenticated &&
      product.seller._id.toString() === res.locals.user._id.toString();

    const [similarProducts, productReviews, sellerRating, myProducts] = await Promise.all([
      campusFeatures.getSimilarProducts(product._id, req.user && req.user._id),
      campusFeatures.getProductReviews(product._id),
      campusFeatures.getSellerRating(product.seller._id),
      req.user && !isOwner ? productService.getMyProducts(req.user._id) : Promise.resolve([]),
    ]);

    return res.render('pages/product', {
      title: `${product.title} — Campus Marketplace`,
      product,
      categories,
      isOwner,
      similarProducts,
      productReviews,
      sellerRating,
      myProducts,
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
