'use strict';

const QRCode = require('qrcode');
const CampusRecord = require('../models/CampusRecord');
const Product = require('../models/Product');
const Report = require('../models/Report');
const User = require('../models/User');
const { config } = require('../config/env');
const api = require('../utils/apiResponse');
const features = require('../services/campus-feature.service');
const ai = require('../services/ai.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

function handler(operation) {
  return async (req, res, next) => {
    try {
      const result = await operation(req);
      if (result && result.created) return api.created(res, result.data, result.message);
      if (result && result.noContent) return api.noContent(res);
      if (result && result.message) return api.success(res, result.data, result.message);
      return api.success(res, result);
    } catch (error) {
      return next(error);
    }
  };
}

const userId = (req) => req.user._id;

const controller = {
  wishlist: handler(async (req) => ({ products: await features.getWishlist(userId(req)) })),
  addWishlist: handler(async (req) => ({ created: true, data: { products: await features.addWishlist(userId(req), req.params.productId) }, message: 'Listing added to wishlist.' })),
  removeWishlist: handler(async (req) => { await features.removeWishlist(userId(req), req.params.productId); return { products: await features.getWishlist(userId(req)) }; }),
  recent: handler(async (req) => ({ products: await features.getRecentlyViewed(userId(req)) })),
  similar: handler(async (req) => ({ products: await features.getSimilarProducts(req.params.productId, userId(req)) })),
  savedSearches: handler(async (req) => ({ savedSearches: await features.getRecords(userId(req), 'saved-search') })),
  saveSearch: handler(async (req) => ({ created: true, data: { savedSearch: await features.saveSearch(userId(req), req.body.title, req.body.filters) }, message: 'Search saved.' })),
  deleteSearch: handler(async (req) => { await features.removeRecord(userId(req), req.params.id, 'saved-search'); return { deleted: true }; }),
  notifications: handler(async (req) => ({ notifications: await features.getNotifications(userId(req)) })),
  readNotifications: handler(async (req) => { await features.markNotificationsRead(userId(req)); return { updated: true }; }),
  interests: handler(async (req) => {
    if (req.method === 'GET') {
      const user = await User.findById(userId(req)).populate('interests', 'name').lean();
      return { interests: user.interests || [] };
    }
    return { interests: await features.saveInterests(userId(req), req.body.categoryIds) };
  }),
  blocks: handler(async (req) => ({ blocks: await features.getBlocks(userId(req)) })),
  block: handler(async (req) => { await features.blockUser(userId(req), req.params.userId); return { blocked: true }; }),
  unblock: handler(async (req) => { await features.unblockUser(userId(req), req.params.userId); return { blocked: false }; }),
  offers: handler(async (req) => ({ offers: await features.getOffers(userId(req)) })),
  createOffer: handler(async (req) => ({ created: true, data: { offer: await features.createOffer(userId(req), req.body) }, message: 'Offer sent.' })),
  respondOffer: handler(async (req) => ({
    offer: await features.respondToOffer(userId(req), req.params.id, req.body.action, req.body),
  })),
  orders: handler(async (req) => ({ orders: await features.getOrders(userId(req)) })),
  orderQr: handler(async (req) => features.createOrderQr(userId(req), req.params.id, QRCode, config.jwt.secret)),
  completeOrder: handler(async (req) => ({ order: await features.completeOrder(userId(req), req.params.id, req.body.token, config.jwt.secret) })),
  cancelOrder: handler(async (req) => ({ order: await features.cancelOrder(userId(req), req.params.id) })),
  pickup: handler(async (req) => ({ order: await features.setPickupTime(userId(req), req.params.id, req.body.pickupAt) })),
  review: handler(async (req) => ({ created: true, data: { review: await features.createReview(userId(req), req.body.orderId, req.body) }, message: 'Review submitted.' })),
  listingReviews: handler(async (req) => ({ reviews: await features.getProductReviews(req.params.productId) })),
  reserve: handler(async (req) => features.reserveProduct(userId(req), req.params.productId, req.body.buyerId, req.body.expiresAt)),
  reportSeller: handler(async (req) => {
    if (String(userId(req)) === String(req.params.userId)) throw new ValidationError('You cannot report your own account.');
    const seller = await User.findById(req.params.userId);
    if (!seller) throw new NotFoundError('Seller');
    const report = await Report.create({
      targetType: 'seller',
      reportedSeller: seller._id,
      reportedBy: userId(req),
      reason: req.body.reason,
      description: req.body.description,
    });
    return { created: true, data: { report }, message: 'Seller report submitted.' };
  }),
  verificationRequest: handler(async (req) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const college = String(req.body.college || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !college) throw new ValidationError('Provide a valid college email and college name.');
    const existing = await User.findOne({ email, _id: { $ne: userId(req) } }).select('_id');
    if (existing) throw new ValidationError('That college email is already associated with another account.');
    await User.updateOne({ _id: userId(req) }, { $set: { collegeEmail: email, college } });
    return { verification: 'pending', message: 'College verification requires an email delivery service, which is not configured yet.' };
  }),
  profile: handler(async (req) => ({ stats: await features.getProfileStats(req.params.userId) })),
  generateListing: handler(async (req) => ({ listing: await ai.generateListing(req.body.description) })),
  recommendPrice: handler(async (req) => ({ recommendation: await ai.recommendPrice(req.body) })),
  assistant: handler(async (req) => ({ answer: await ai.answerMarketplaceQuestion(req.body.question, userId(req)) })),
  qualityCheck: handler(async (req) => ({ assessment: await ai.checkListing(req.body.listing) })),
  scamCheck: handler(async (req) => ({ assessment: await ai.detectScam(req.body.listing) })),
  scanListingForFraud: handler(async (req) => {
    const product = await Product.findById(req.body.productId)
      .populate('seller', 'name college collegeVerified')
      .populate('category', 'name');
    if (!product) throw new NotFoundError('Listing');
    const assessment = await ai.detectScam({
      title: product.title,
      description: product.description,
      price: product.price,
      condition: product.condition,
      listingType: product.listingType,
      category: product.category && product.category.name,
      itemDetails: product.details instanceof Map ? Object.fromEntries(product.details) : product.details,
      hasImages: Array.isArray(product.images) && product.images.length > 0,
      seller: {
        college: product.seller && product.seller.college,
        collegeVerified: product.seller && product.seller.collegeVerified,
      },
    });
    const wasAlreadyPendingReview = product.aiReviewStatus === 'pending-review';
    if (assessment.needsAdminReview) {
      product.aiReviewStatus = 'pending-review';
      product.aiRiskFlags = assessment.riskFlags;
      await product.save();
      if (!wasAlreadyPendingReview) {
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        if (admins.length) {
          await CampusRecord.insertMany(admins.map((admin) => ({
            owner: admin._id,
            type: 'notification',
            product: product._id,
            content: `AI flagged listing "${product.title}" for human review: ${assessment.riskFlags.join(', ')}`,
          })));
        }
      }
    } else {
      product.aiReviewStatus = 'clear';
      product.aiRiskFlags = [];
      await product.save();
    }
    return { assessment };
  }),
  compare: handler(async (req) => {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 4);
    if (ids.length < 2 || ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) throw new ValidationError('Choose between 2 and 4 valid listing IDs to compare.');
    const products = await Product.find({ _id: { $in: ids }, status: 'available' })
      .populate('seller', 'name college collegeVerified')
      .populate('category', 'name')
      .lean();
    const reviews = await Promise.all(products.map((product) => features.getSellerRating(product.seller._id)));
    return { products: products.map((product, index) => ({ ...product, sellerRating: reviews[index].average, sellerReviewCount: reviews[index].count })) };
  }),
};

module.exports = controller;
