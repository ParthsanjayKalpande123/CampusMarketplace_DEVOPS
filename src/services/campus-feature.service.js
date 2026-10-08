'use strict';

const crypto = require('crypto');
const CampusRecord = require('../models/CampusRecord');
const Offer = require('../models/Offer');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const User = require('../models/User');
const { NotFoundError, AuthorizationError, ConflictError, ValidationError } = require('../utils/errors');

const PUBLIC_SELLER = 'name college phone profileImage collegeVerified';

async function notify(owner, content, product = null, targetUser = null) {
  await CampusRecord.create({ owner, type: 'notification', content, product, targetUser });
}

async function getProduct(productId) {
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('Listing');
  return product;
}

async function isBlocked(userA, userB) {
  const ids = [userA, userB];
  return CampusRecord.exists({
    type: 'block',
    $or: [
      { owner: ids[0], targetUser: ids[1] },
      { owner: ids[1], targetUser: ids[0] },
    ],
  });
}

async function getHiddenUserIds(owner) {
  const records = await CampusRecord.find({
    type: 'block',
    $or: [{ owner }, { targetUser: owner }],
  }).select('owner targetUser').lean();
  return records.map((record) => (
    String(record.owner) === String(owner) ? record.targetUser : record.owner
  )).filter(Boolean);
}

async function getWishlist(owner) {
  const items = await CampusRecord.find({ owner, type: 'wishlist' })
    .populate({ path: 'product', populate: [{ path: 'seller', select: PUBLIC_SELLER }, { path: 'category', select: 'name' }] })
    .sort({ createdAt: -1 })
    .lean();
  const hidden = await getHiddenUserIds(owner);
  return items.filter((item) => item.product && item.product.seller && item.product.status === 'available'
    && !hidden.some((id) => String(id) === String(item.product.seller._id))).map((item) => item.product);
}

async function addWishlist(owner, productId) {
  const product = await getProduct(productId);
  if (product.status !== 'available') throw new ConflictError('Only available listings can be wishlisted.');
  await CampusRecord.updateOne(
    { owner, type: 'wishlist', product: productId },
    { $setOnInsert: { owner, type: 'wishlist', product: productId } },
    { upsert: true }
  );
  return getWishlist(owner);
}

async function removeWishlist(owner, productId) {
  await CampusRecord.deleteOne({ owner, type: 'wishlist', product: productId });
  return getWishlist(owner);
}

async function addRecentlyViewed(owner, productId) {
  await CampusRecord.deleteOne({ owner, type: 'recently-viewed', product: productId });
  await CampusRecord.create({ owner, type: 'recently-viewed', product: productId });
  const stale = await CampusRecord.find({ owner, type: 'recently-viewed' })
    .sort({ createdAt: -1 }).skip(20).select('_id').lean();
  if (stale.length) await CampusRecord.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
}

async function getRecentlyViewed(owner) {
  const items = await CampusRecord.find({ owner, type: 'recently-viewed' })
    .populate({ path: 'product', populate: [{ path: 'seller', select: PUBLIC_SELLER }, { path: 'category', select: 'name' }] })
    .sort({ createdAt: -1 }).lean();
  const hidden = await getHiddenUserIds(owner);
  return items.filter((item) => item.product && item.product.seller && item.product.status === 'available'
    && !hidden.some((id) => String(id) === String(item.product.seller._id))).map((item) => item.product);
}

async function getSimilarProducts(productId, viewerId = null) {
  const product = await getProduct(productId);
  const hidden = viewerId ? await getHiddenUserIds(viewerId) : [];
  return Product.find({
    _id: { $ne: product._id },
    category: product.category,
    status: 'available',
    ...(hidden.length ? { seller: { $nin: hidden } } : {}),
  })
    .populate('seller', 'name college collegeVerified')
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
}

async function saveSearch(owner, title, filters) {
  const allowed = ['q', 'category', 'condition', 'minPrice', 'maxPrice', 'college'];
  if (!title || typeof title !== 'string' || title.trim().length > 120) {
    throw new ValidationError('A search name of up to 120 characters is required.');
  }
  const safeFilters = {};
  for (const key of allowed) {
    if (filters && typeof filters[key] === 'string' && filters[key].trim()) {
      safeFilters[key] = filters[key].trim().slice(0, 200);
    }
  }
  if (!Object.keys(safeFilters).length) throw new ValidationError('Enter at least one search filter.');
  return CampusRecord.create({ owner, type: 'saved-search', title: title.trim(), filters: safeFilters });
}

async function getRecords(owner, type) {
  return CampusRecord.find({ owner, type }).sort({ createdAt: -1 }).lean();
}

async function removeRecord(owner, recordId, type) {
  const result = await CampusRecord.deleteOne({ _id: recordId, owner, type });
  if (!result.deletedCount) throw new NotFoundError('Saved item');
}

async function getNotifications(owner) {
  return CampusRecord.find({ owner, type: 'notification' })
    .populate('product', 'title status')
    .populate('targetUser', 'name')
    .sort({ createdAt: -1 }).limit(100).lean();
}

async function markNotificationsRead(owner) {
  await CampusRecord.updateMany(
    { owner, type: 'notification', readAt: null },
    { $set: { readAt: new Date() } }
  );
}

async function saveInterests(owner, categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length > 20 || categoryIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
    throw new ValidationError('Choose up to 20 valid category interests.');
  }
  const user = await User.findByIdAndUpdate(owner, { $set: { interests: [...new Set(categoryIds)] } }, { new: true })
    .populate('interests', 'name');
  return user.interests;
}

async function blockUser(owner, targetUser) {
  if (String(owner) === String(targetUser)) throw new ValidationError('You cannot block your own account.');
  const target = await User.findById(targetUser);
  if (!target) throw new NotFoundError('User');
  await CampusRecord.updateOne(
    { owner, type: 'block', targetUser },
    { $setOnInsert: { owner, type: 'block', targetUser } },
    { upsert: true }
  );
}

async function unblockUser(owner, targetUser) {
  await CampusRecord.deleteOne({ owner, type: 'block', targetUser });
}

async function getBlocks(owner) {
  return CampusRecord.find({ owner, type: 'block' }).populate('targetUser', 'name college').lean();
}

async function createOffer(buyerId, data, parentOffer = null) {
  const product = await getProduct(data.productId);
  if (product.status !== 'available' || (!parentOffer && String(product.seller) === String(buyerId))) {
    throw new ConflictError('This listing is unavailable or belongs to you.');
  }
  const original = parentOffer ? await Offer.findById(parentOffer) : null;
  if (parentOffer && (!original || String(original.toUser) !== String(buyerId) || original.status !== 'pending')) {
    throw new AuthorizationError('You cannot counter this offer.');
  }
  const buyer = original ? original.buyer : buyerId;
  const seller = original ? original.seller : product.seller;
  const fromUser = original ? original.toUser : buyerId;
  const toUser = original ? original.fromUser : product.seller;
  if (await isBlocked(fromUser, toUser)) throw new AuthorizationError('You cannot contact this user.');
  const kind = data.kind === 'exchange' ? 'exchange' : 'price';
  if (kind === 'price' && (!Number.isFinite(Number(data.amount)) || Number(data.amount) < 0 || Number(data.amount) > 999999)) {
    throw new ValidationError('Offer amount must be between zero and 999,999.');
  }
  if (kind === 'exchange' && !product.isExchangeable) {
    throw new ConflictError('The seller is not accepting exchanges for this listing.');
  }
  let exchangeProduct = null;
  if (kind === 'exchange') {
    exchangeProduct = await Product.findOne({ _id: data.exchangeProductId, seller: fromUser, status: 'available' });
    if (!exchangeProduct) throw new ValidationError('Select one of your available listings to exchange.');
  }
  const offer = await Offer.create({
    product: product._id,
    buyer,
    seller,
    fromUser,
    toUser,
    kind,
    amount: kind === 'price' ? Number(data.amount) : null,
    exchangeProduct: exchangeProduct && exchangeProduct._id,
    additionalCash: Math.max(0, Number(data.additionalCash) || 0),
    message: String(data.message || '').trim().slice(0, 500) || null,
    parentOffer,
  });
  await notify(toUser, `${kind === 'exchange' ? 'New exchange proposal' : 'New price offer'} for ${product.title}.`, product._id, fromUser);
  return offer;
}

async function acceptOffer(userId, offer) {
  const product = await Product.findOneAndUpdate(
    { _id: offer.product, status: 'available' },
    { $set: { status: 'reserved', reservedFor: offer.buyer } },
    { new: true }
  );
  if (!product) throw new ConflictError('The listing is no longer available.');
  let order;
  try {
    order = await Order.create({
      product: offer.product,
      buyer: offer.buyer,
      seller: offer.seller,
      offer: offer._id,
      kind: offer.kind === 'exchange' ? 'exchange' : 'purchase',
      paymentStatus: offer.kind === 'exchange' ? 'not-applicable' : 'not-integrated',
    });
  } catch (error) {
    await Product.updateOne(
      { _id: offer.product, status: 'reserved', reservedFor: offer.buyer },
      { $set: { status: 'available' }, $unset: { reservedFor: 1, reservationExpiresAt: 1 } }
    );
    throw error;
  }
  offer.status = 'accepted';
  offer.order = order._id;
  await offer.save();
  await notify(offer.buyer, `Your offer for ${product.title} was accepted. Arrange pickup with the seller.`, product._id, userId);
  await notify(offer.seller, `An order was created for ${product.title}. Arrange campus pickup with the buyer.`, product._id, offer.buyer);
  return order;
}

async function respondToOffer(userId, offerId, action, data = {}) {
  const offer = await Offer.findById(offerId);
  if (!offer) throw new NotFoundError('Offer');
  if (![String(offer.buyer), String(offer.seller)].includes(String(userId))) {
    throw new AuthorizationError();
  }
  if (String(offer.toUser) !== String(userId)) throw new AuthorizationError('This offer is not awaiting your response.');
  if (offer.status !== 'pending') throw new ConflictError('This offer has already been answered.');
  if (action === 'accept') return acceptOffer(userId, offer);
  if (action === 'reject') {
    offer.status = 'rejected';
    await offer.save();
    await notify(offer.fromUser, 'Your offer was declined.', offer.product, userId);
    return offer;
  }
  if (action !== 'counter') throw new ValidationError('Choose accept, reject, or counter.');
  const counter = await createOffer(userId, { ...data, productId: offer.product }, offer._id);
  offer.status = 'countered';
  await offer.save();
  return counter;
}

async function getOffers(userId) {
  return Offer.find({ $or: [{ buyer: userId }, { seller: userId }] })
    .populate('product', 'title price status')
    .populate('buyer', 'name college')
    .populate('seller', 'name college')
    .populate('exchangeProduct', 'title price')
    .populate('fromUser', 'name college')
    .populate('toUser', 'name college')
    .sort({ createdAt: -1 }).lean();
}

async function getOrders(userId) {
  return Order.find({ $or: [{ buyer: userId }, { seller: userId }] })
    .populate('product', 'title price imageUrl status')
    .populate('buyer', 'name college')
    .populate('seller', 'name college')
    .sort({ createdAt: -1 }).lean();
}

async function createOrderQr(userId, orderId, QRCode, secret) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order');
  if (String(order.buyer) !== String(userId)) throw new AuthorizationError('Only the buyer can generate the handover QR.');
  if (order.status !== 'active') throw new ConflictError('This order is no longer active.');
  const payload = `${order._id}.${Date.now()}.${crypto.randomBytes(12).toString('hex')}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${signature}`;
  return { qrCode: await QRCode.toDataURL(token), token };
}

async function completeOrder(userId, orderId, token, secret) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order');
  if (String(order.seller) !== String(userId)) throw new AuthorizationError('Only the seller can confirm handover.');
  if (order.status !== 'active') throw new ConflictError('This order is no longer active.');
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== String(order._id)) throw new ValidationError('Invalid order QR code.');
  const payload = parts.slice(0, 3).join('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(parts[3], 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new ValidationError('Invalid order QR code.');
  }
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 48 * 60 * 60 * 1000 || issuedAt > Date.now()) {
    throw new ValidationError('This order QR code has expired.');
  }
  order.status = 'completed';
  order.completedAt = new Date();
  await order.save();
  await Product.updateOne(
    { _id: order.product, reservedFor: order.buyer },
    { $set: { status: order.kind === 'exchange' ? 'exchanged' : 'sold' }, $unset: { reservedFor: 1, reservationExpiresAt: 1 } }
  );
  if (order.kind === 'exchange') {
    const offer = await Offer.findById(order.offer);
    if (offer && offer.exchangeProduct) {
      await Product.updateOne({ _id: offer.exchangeProduct, seller: order.buyer }, { $set: { status: 'exchanged' } });
      await CampusRecord.deleteMany({ type: 'wishlist', product: offer.exchangeProduct });
    }
  }
  await CampusRecord.deleteMany({ type: 'wishlist', product: order.product });
  await notify(order.buyer, 'The seller confirmed the handover. You can now leave your reviews.', order.product, userId);
  return order;
}

async function cancelOrder(userId, orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order');
  if (![String(order.buyer), String(order.seller)].includes(String(userId))) throw new AuthorizationError();
  if (order.status !== 'active') throw new ConflictError('Only active orders can be cancelled.');
  order.status = 'cancelled';
  await order.save();
  await Product.updateOne(
    { _id: order.product, status: 'reserved', reservedFor: order.buyer },
    { $set: { status: 'available' }, $unset: { reservedFor: 1, reservationExpiresAt: 1 } }
  );
  await notify(String(order.buyer) === String(userId) ? order.seller : order.buyer, 'An active order was cancelled.', order.product, userId);
  return order;
}

async function setPickupTime(userId, orderId, pickupAt) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order');
  if (![String(order.buyer), String(order.seller)].includes(String(userId))) throw new AuthorizationError();
  if (order.status !== 'active') throw new ConflictError('Only active orders can schedule pickup.');
  const date = new Date(pickupAt);
  if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new ValidationError('Pickup time must be in the future.');
  order.pickupAt = date;
  await order.save();
  return order;
}

async function createReview(userId, orderId, data) {
  const order = await Order.findOne({ _id: orderId, status: 'completed' });
  if (!order) throw new ConflictError('Reviews are available only after completed orders.');
  if (String(order.buyer) !== String(userId)) throw new AuthorizationError('Only the buyer can leave reviews.');
  const type = data.type === 'product' ? 'product' : 'seller';
  const review = await Review.create({
    order: order._id, author: userId, targetUser: order.seller, product: order.product,
    type, rating: Number(data.rating), text: String(data.text || '').trim().slice(0, 1000),
  });
  await notify(order.seller, `You received a ${type} review.`, order.product, userId);
  return review;
}

async function getProfileStats(userId) {
  const [sellerReviews, sold, bought, reviews, products] = await Promise.all([
    Review.find({ targetUser: userId, type: 'seller' }).select('rating text author createdAt').populate('author', 'name').sort({ createdAt: -1 }).lean(),
    Order.countDocuments({ seller: userId, status: 'completed' }),
    Order.countDocuments({ buyer: userId, status: 'completed' }),
    Review.find({ targetUser: userId, type: 'seller' }).select('rating').lean(),
    Product.find({ seller: userId }).select('category').lean(),
  ]);
  const averageRating = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null;
  const trustScore = Math.min(100, Math.round((averageRating ? averageRating * 12 : 35) + Math.min(sold, 25) * 1.5 + (products.length ? 10 : 0)));
  return { sellerReviews, sold, bought, averageRating, reviewCount: reviews.length, trustScore };
}

async function getProductReviews(productId) {
  return Review.find({ product: productId, type: 'product' })
    .populate('author', 'name collegeVerified')
    .sort({ createdAt: -1 }).lean();
}

async function getSellerRating(userId) {
  const result = await Review.aggregate([
    { $match: { targetUser: new (require('mongoose').Types.ObjectId)(String(userId)), type: 'seller' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return result[0] || { average: null, count: 0 };
}

async function reserveProduct(userId, productId, buyerId, expiresAt) {
  const product = await getProduct(productId);
  if (String(product.seller) !== String(userId)) throw new AuthorizationError();
  if (product.status !== 'available') throw new ConflictError('Only available listings can be reserved.');
  const buyer = await User.findById(buyerId);
  if (!buyer) throw new NotFoundError('Buyer');
  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) throw new ValidationError('Reservation expiry must be in the future.');
  product.status = 'reserved';
  product.reservedFor = buyerId;
  product.reservationExpiresAt = expiry;
  await product.save();
  let order;
  try {
    order = await Order.create({
      product: product._id, buyer: buyerId, seller: userId, kind: 'purchase', paymentStatus: 'not-integrated',
    });
  } catch (error) {
    await Product.updateOne(
      { _id: product._id, status: 'reserved', reservedFor: buyerId },
      { $set: { status: 'available' }, $unset: { reservedFor: 1, reservationExpiresAt: 1 } }
    );
    throw error;
  }
  await notify(buyerId, `A listing has been reserved for you: ${product.title}.`, product._id, userId);
  return { product, order };
}

async function releaseExpiredReservations() {
  const expired = await Product.find({ status: 'reserved', reservationExpiresAt: { $lte: new Date(), $ne: null } }).select('_id');
  if (!expired.length) return 0;
  await Product.updateMany(
    { _id: { $in: expired.map((item) => item._id) } },
    { $set: { status: 'available' }, $unset: { reservedFor: 1, reservationExpiresAt: 1 } }
  );
  await Order.updateMany(
    { product: { $in: expired.map((item) => item._id) }, status: 'active' },
    { $set: { status: 'cancelled' } }
  );
  return expired.length;
}

async function findSearchMatches(product) {
  const searches = await CampusRecord.find({ type: 'saved-search' }).lean();
  const matches = [];
  for (const search of searches) {
    const filters = search.filters || {};
    const titleAndDescription = `${product.title} ${product.description}`.toLowerCase();
    if (filters.q && !titleAndDescription.includes(filters.q.toLowerCase())) continue;
    if (filters.category && String(filters.category) !== String(product.category)) continue;
    if (filters.condition && filters.condition !== product.condition) continue;
    if (filters.minPrice && product.price < Number(filters.minPrice)) continue;
    if (filters.maxPrice && product.price > Number(filters.maxPrice)) continue;
    if (filters.college) {
      const seller = await User.findById(product.seller).select('college').lean();
      if (!seller || !seller.college || !seller.college.toLowerCase().includes(filters.college.toLowerCase())) continue;
    }
    matches.push({ owner: search.owner, type: 'notification', product: product._id, content: `A new listing matches your saved search "${search.title}".` });
  }
  if (matches.length) await CampusRecord.insertMany(matches);
}

async function notifyPriceDrop(productId, oldPrice, newPrice) {
  if (newPrice >= oldPrice) return;
  const watchers = await CampusRecord.find({ type: 'wishlist', product: productId }).select('owner').lean();
  if (watchers.length) {
    await CampusRecord.insertMany(watchers.map(({ owner }) => ({
      owner, type: 'notification', product: productId,
      content: `Price drop: the listing price changed from ₹${oldPrice} to ₹${newPrice}.`,
    })));
  }
}

module.exports = {
  addWishlist, removeWishlist, getWishlist, addRecentlyViewed, getRecentlyViewed, getSimilarProducts,
  saveSearch, getRecords, removeRecord, getNotifications, markNotificationsRead, saveInterests,
  blockUser, unblockUser, getBlocks, isBlocked, createOffer, respondToOffer, getOffers,
  getOrders, createOrderQr, completeOrder, cancelOrder, setPickupTime, createReview, getProfileStats,
  getProductReviews, getSellerRating, reserveProduct, releaseExpiredReservations, findSearchMatches,
  notifyPriceDrop, notify, getHiddenUserIds,
};
