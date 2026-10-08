'use strict';

const { Router } = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const controller = require('../controllers/campus-feature.controller');

const router = Router();
router.use(verifyToken);

router.get('/wishlist', controller.wishlist);
router.post('/wishlist/:productId', controller.addWishlist);
router.delete('/wishlist/:productId', controller.removeWishlist);
router.get('/recently-viewed', controller.recent);
router.get('/similar/:productId', controller.similar);
router.get('/saved-searches', controller.savedSearches);
router.post('/saved-searches', controller.saveSearch);
router.delete('/saved-searches/:id', controller.deleteSearch);
router.get('/notifications', controller.notifications);
router.patch('/notifications/read', controller.readNotifications);
router.get('/interests', controller.interests);
router.put('/interests', controller.interests);
router.get('/blocks', controller.blocks);
router.post('/blocks/:userId', controller.block);
router.delete('/blocks/:userId', controller.unblock);
router.get('/offers', controller.offers);
router.post('/offers', controller.createOffer);
router.patch('/offers/:id/respond', controller.respondOffer);
router.get('/orders', controller.orders);
router.get('/orders/:id/qr', controller.orderQr);
router.post('/orders/:id/complete', controller.completeOrder);
router.post('/orders/:id/cancel', controller.cancelOrder);
router.patch('/orders/:id/pickup', controller.pickup);
router.post('/reviews', controller.review);
router.get('/products/:productId/reviews', controller.listingReviews);
router.post('/products/:productId/reserve', controller.reserve);
router.post('/sellers/:userId/report', controller.reportSeller);
router.get('/sellers/:userId/stats', controller.profile);
router.post('/verification/request', controller.verificationRequest);
router.post('/ai/listing', controller.generateListing);
router.post('/ai/price', controller.recommendPrice);
router.post('/ai/assistant', controller.assistant);
router.post('/ai/quality', controller.qualityCheck);
router.post('/ai/fraud', controller.scamCheck);
router.post('/ai/fraud/listing', controller.scanListingForFraud);
router.get('/compare', controller.compare);

module.exports = router;
