'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { config } = require('../src/config/env');
const { seedDefaultCategories } = require('../src/services/category.service');
const CampusRecord = require('../src/models/CampusRecord');
const Category = require('../src/models/Category');
const Offer = require('../src/models/Offer');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Report = require('../src/models/Report');
const Review = require('../src/models/Review');
const User = require('../src/models/User');

const DEMO_PASSWORD = crypto.randomBytes(18).toString('base64url');
const DEMO_EMAILS = {
  buyer: 'demo.student@campusmarket.test',
  seller: 'demo.seller@campusmarket.test',
  blocked: 'demo.blocked@campusmarket.test',
};

const DEMO_PRODUCT_IMAGES = {
  calculator: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=900&auto=format&fit=crop',
  textbook: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=900&auto=format&fit=crop',
  stand: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=900&auto=format&fit=crop',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop',
  lamp: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop',
  draftingKit: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&auto=format&fit=crop',
  freeLabCoat: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=900&auto=format&fit=crop',
  lostId: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&auto=format&fit=crop',
  reservedCalculator: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=900&auto=format&fit=crop',
  helmet: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900&auto=format&fit=crop',
  usbHub: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=900&auto=format&fit=crop',
};

async function upsertDemoUser(email, data, passwordHash) {
  const existing = await User.findOne({ email }).select('role');
  if (existing && existing.role !== 'student') {
    throw new Error(`Refusing to replace non-student demo account ${email}.`);
  }
  return User.findOneAndUpdate(
    { email },
    { $set: { ...data, email, passwordHash, role: 'student', isDemo: true } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function upsertDemoProduct(seller, category, product) {
  return Product.findOneAndUpdate(
    { seller: seller._id, title: product.title },
    {
      $set: {
        ...product,
        category: category._id,
        seller: seller._id,
        isDemo: true,
        description: `${product.description} Seeded demo data for local feature previews.`,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function clearDemoActivity(userIds) {
  await Promise.all([
    CampusRecord.deleteMany({ owner: { $in: userIds } }),
    Offer.deleteMany({ $or: [{ buyer: { $in: userIds } }, { seller: { $in: userIds } }] }),
    Order.deleteMany({ $or: [{ buyer: { $in: userIds } }, { seller: { $in: userIds } }] }),
    Review.deleteMany({ $or: [{ author: { $in: userIds } }, { targetUser: { $in: userIds } }] }),
    Report.deleteMany({ $or: [{ reportedBy: { $in: userIds } }, { reportedSeller: { $in: userIds } }] }),
  ]);
}

async function main() {
  if (config.isProduction) {
    throw new Error('Demo data seeding is disabled in production.');
  }

  await mongoose.connect(config.db.uri);
  await seedDefaultCategories();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [buyer, seller, blocked] = await Promise.all([
    upsertDemoUser(DEMO_EMAILS.buyer, {
      name: 'Aarav Mehta (Demo)',
      phone: '+919876540001',
      college: 'Campus Marketplace Demo College',
      collegeEmail: 'aarav@demo-college.edu',
      collegeVerified: true,
      department: 'Computer Engineering',
      year: 'Third Year',
      profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
    }, passwordHash),
    upsertDemoUser(DEMO_EMAILS.seller, {
      name: 'Isha Sharma (Demo)',
      phone: '+919876540002',
      college: 'Campus Marketplace Demo College',
      collegeEmail: 'isha@demo-college.edu',
      collegeVerified: true,
      department: 'Electronics',
      year: 'Second Year',
      profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    }, passwordHash),
    upsertDemoUser(DEMO_EMAILS.blocked, {
      name: 'Demo Blocked Member',
      college: 'Campus Marketplace Demo College',
      collegeVerified: false,
    }, passwordHash),
  ]);
  const userIds = [buyer._id, seller._id, blocked._id];
  await clearDemoActivity(userIds);

  const categoryNames = ['Books & Notes', 'Electronics', 'Furniture', 'Bags & Stationery'];
  const categoryEntries = await Promise.all(categoryNames.map((name) => Category.findOne({ name, isActive: true })));
  const categories = Object.fromEntries(categoryNames.map((name, index) => [name, categoryEntries[index]]));
  for (const [name, category] of Object.entries(categories)) {
    if (!category) throw new Error(`Required demo category "${name}" is missing.`);
  }

  const products = {};
  const productSpecs = [
    {
      key: 'calculator', seller, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.calculator,
      title: '[DEMO] Scientific Calculator FX-991',
      description: 'Good-condition scientific calculator with a clear display and fresh battery.',
      price: 950, condition: 'good', tags: ['calculator', 'engineering', 'demo'],
      details: { brand: 'Casio', model: 'fx-991ES Plus', warranty: 'None' },
      pickupLocation: 'Campus main gate', pickupAvailability: 'Weekdays, 10 AM–4 PM',
    },
    {
      key: 'textbook', seller, category: categories['Books & Notes'],
      imageUrl: DEMO_PRODUCT_IMAGES.textbook,
      title: '[DEMO] Engineering Mathematics Textbook',
      description: 'Second-hand engineering mathematics textbook with clean pages and light highlighting.',
      price: 320, condition: 'like-new', tags: ['engineering', 'textbook', 'demo'],
      details: { author: 'B. S. Grewal', edition: '44th', semester: 'First Year' },
    },
    {
      key: 'stand', seller: buyer, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.stand,
      title: '[DEMO] Adjustable Laptop Stand',
      description: 'Aluminium adjustable laptop stand, suitable for 13 to 16 inch laptops.',
      price: 700, condition: 'good', isExchangeable: true,
      tags: ['laptop stand', 'exchange', 'demo'],
      details: { material: 'Aluminium', dimensions: '26 x 22 cm' },
    },
    {
      key: 'keyboard', seller, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.keyboard,
      title: '[DEMO] Mechanical Keyboard',
      description: 'Compact mechanical keyboard, fully working and lightly used.',
      price: 1800, condition: 'good', status: 'sold',
      tags: ['keyboard', 'electronics', 'demo'],
      details: { brand: 'Keychron', model: 'K2', warranty: '6 months' },
    },
    {
      key: 'lamp', seller: buyer, category: categories.Furniture,
      imageUrl: DEMO_PRODUCT_IMAGES.lamp,
      title: '[DEMO] Adjustable Study Desk Lamp',
      description: 'LED study lamp with adjustable brightness and a flexible neck.',
      price: 450, condition: 'like-new', status: 'sold',
      tags: ['study', 'lamp', 'demo'],
      details: { material: 'Metal and plastic' },
    },
    {
      key: 'camera', seller, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.camera,
      title: '[DEMO] Camera Lens - Reserved Order',
      description: 'Demonstration camera lens reserved for an active campus pickup order.',
      price: 4200, condition: 'good', status: 'reserved', reservedFor: buyer._id,
      reservationExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      tags: ['camera', 'lens', 'demo'],
      details: { brand: 'Canon', model: 'EF 50mm' },
    },
    {
      key: 'draftingKit', seller, category: categories['Books & Notes'],
      imageUrl: DEMO_PRODUCT_IMAGES.draftingKit,
      title: '[DEMO] Engineering Drafting Kit',
      description: 'Basic engineering drawing kit with compass, ruler, and set squares.',
      price: 280, condition: 'fair', tags: ['engineering', 'drawing', 'demo'],
      details: { subject: 'Engineering Graphics', semester: 'First Year' },
    },
    {
      key: 'freeLabCoat', seller, category: categories['Bags & Stationery'],
      imageUrl: DEMO_PRODUCT_IMAGES.freeLabCoat,
      title: '[DEMO] Free Lab Coat',
      description: 'Clean lab coat available as a free campus giveaway.',
      price: 0, condition: 'good', listingType: 'free',
      tags: ['free', 'lab', 'demo'],
    },
    {
      key: 'lostId', seller: buyer, category: categories['Bags & Stationery'],
      imageUrl: DEMO_PRODUCT_IMAGES.lostId,
      title: '[DEMO] Lost Student ID Card',
      description: 'Demo lost-and-found post for a student ID card near the campus library.',
      price: 0, condition: 'good', listingType: 'lost',
      location: 'Campus library', lostFoundDate: new Date(),
      tags: ['lost and found', 'demo'],
    },
    {
      key: 'reservedCalculator', seller: buyer, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.reservedCalculator,
      title: '[DEMO] Reserved Graphing Calculator',
      description: 'Graphing calculator reserved for a campus buyer.',
      price: 2100, condition: 'good', status: 'reserved', reservedFor: seller._id,
      reservationExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      tags: ['calculator', 'reserved', 'demo'],
    },
    {
      key: 'helmet', seller, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.helmet,
      title: '[DEMO] Exchangeable Bike Helmet',
      description: 'Lightly used bike helmet; seller is open to a fair exchange.',
      price: 500, condition: 'like-new', isExchangeable: true,
      tags: ['bike', 'helmet', 'exchange', 'demo'],
    },
    {
      key: 'usbHub', seller, category: categories.Electronics,
      imageUrl: DEMO_PRODUCT_IMAGES.usbHub,
      title: '[DEMO] USB-C Laptop Hub',
      description: 'USB-C hub with HDMI, USB-A, and SD card ports.',
      price: 850, condition: 'good', tags: ['laptop', 'usb-c', 'demo'],
      details: { brand: 'Anker', model: '7-in-1' },
    },
  ];

  for (const specification of productSpecs) {
    const { key, ...product } = specification;
    products[key] = await upsertDemoProduct(product.seller, product.category, product);
  }

  const activeOrder = await Order.create({
    product: products.camera._id, buyer: buyer._id, seller: seller._id,
    kind: 'purchase', status: 'active', paymentStatus: 'not-integrated',
    pickupAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  });
  const buyerCompletedOrder = await Order.create({
    product: products.keyboard._id, buyer: buyer._id, seller: seller._id,
    kind: 'purchase', status: 'completed', paymentStatus: 'not-integrated',
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  });
  const sellerCompletedOrder = await Order.create({
    product: products.lamp._id, buyer: seller._id, seller: buyer._id,
    kind: 'purchase', status: 'completed', paymentStatus: 'not-integrated',
    completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  });
  const cancelledOrder = await Order.create({
    product: products.draftingKit._id, buyer: buyer._id, seller: seller._id,
    kind: 'purchase', status: 'cancelled', paymentStatus: 'not-integrated',
  });
  void activeOrder;
  void cancelledOrder;

  const acceptedOffer = await Offer.create({
    product: products.keyboard._id, buyer: buyer._id, seller: seller._id,
    fromUser: buyer._id, toUser: seller._id, kind: 'price', amount: 1650,
    status: 'accepted', order: buyerCompletedOrder._id,
  });
  buyerCompletedOrder.offer = acceptedOffer._id;
  await buyerCompletedOrder.save();
  await Offer.insertMany([
    {
      product: products.stand._id, buyer: seller._id, seller: buyer._id,
      fromUser: seller._id, toUser: buyer._id, kind: 'price', amount: 550,
      status: 'pending', message: 'Would you consider this price?',
    },
    {
      product: products.calculator._id, buyer: buyer._id, seller: seller._id,
      fromUser: buyer._id, toUser: seller._id, kind: 'price', amount: 780,
      status: 'pending', message: 'I can meet on campus this week.',
    },
    {
      product: products.helmet._id, buyer: buyer._id, seller: seller._id,
      fromUser: buyer._id, toUser: seller._id, kind: 'exchange',
      exchangeProduct: products.stand._id, additionalCash: 0,
      status: 'pending', message: 'Would you exchange for my laptop stand?',
    },
  ]);

  await Review.insertMany([
    {
      order: buyerCompletedOrder._id, author: buyer._id, targetUser: seller._id,
      product: products.keyboard._id, type: 'seller', rating: 5,
      text: 'Friendly seller and smooth campus pickup.',
    },
    {
      order: buyerCompletedOrder._id, author: buyer._id, targetUser: seller._id,
      product: products.keyboard._id, type: 'product', rating: 5,
      text: 'Keyboard matched the listing and works perfectly.',
    },
    {
      order: sellerCompletedOrder._id, author: seller._id, targetUser: buyer._id,
      product: products.lamp._id, type: 'seller', rating: 5,
      text: 'Clear communication and an easy handover.',
    },
    {
      order: sellerCompletedOrder._id, author: seller._id, targetUser: buyer._id,
      product: products.lamp._id, type: 'product', rating: 4,
      text: 'Good study lamp in excellent condition.',
    },
  ]);

  const now = new Date();
  await CampusRecord.insertMany([
    ...[products.calculator, products.textbook, products.helmet].map((product) => ({
      owner: buyer._id, type: 'wishlist', product: product._id,
    })),
    ...[products.calculator, products.usbHub, products.textbook].map((product) => ({
      owner: buyer._id, type: 'recently-viewed', product: product._id,
    })),
    {
      owner: buyer._id, type: 'saved-search', title: 'Laptop under ₹30,000',
      filters: { q: 'laptop', maxPrice: '30000' },
    },
    {
      owner: buyer._id, type: 'saved-search', title: 'Engineering books',
      filters: { q: 'engineering', category: String(categories['Books & Notes']._id) },
    },
    {
      owner: buyer._id, type: 'notification', product: products.stand._id,
      targetUser: seller._id, content: 'You received a new offer for your laptop stand.',
    },
    {
      owner: buyer._id, type: 'notification', product: products.camera._id,
      targetUser: seller._id, content: 'Your camera lens order is ready for campus pickup.',
    },
    {
      owner: buyer._id, type: 'notification', product: products.keyboard._id,
      targetUser: seller._id, content: 'Your completed order is ready for a review.',
      readAt: now,
    },
    {
      owner: buyer._id, type: 'notification', product: products.helmet._id,
      targetUser: seller._id, content: 'A student sent you an exchange proposal.',
    },
    { owner: buyer._id, type: 'block', targetUser: blocked._id },
  ]);

  buyer.interests = [categories.Electronics._id, categories['Books & Notes']._id];
  await buyer.save();
  await Report.create({
    targetType: 'seller', reportedSeller: blocked._id, reportedBy: buyer._id,
    reason: 'misleading_information', description: 'Seeded demo seller report for local admin-review previews.',
  });

  console.log('Local demo data is ready.');
  console.log(`Demo student: ${DEMO_EMAILS.buyer} / ${DEMO_PASSWORD}`);
  console.log(`Demo seller:  ${DEMO_EMAILS.seller} / ${DEMO_PASSWORD}`);
  console.log(`Compare demo products: http://localhost:3000/account/features?compare=${products.calculator._id},${products.usbHub._id}#discover`);
}

main()
  .catch((error) => {
    console.error(`Demo data seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
