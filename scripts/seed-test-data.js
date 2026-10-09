'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { config } = require('../src/config/env');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

const EXPECTED_DATABASE = 'campus_marketplace';
const BATCH_TAG = 'demo-test-seed-v1';
const USER_COUNT = 25;
const LISTING_COUNT = 150;
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', 'mongodb']);

const FIRST_NAMES = [
  'Aarav', 'Isha', 'Kabir', 'Anaya', 'Vihaan',
  'Meera', 'Arjun', 'Diya', 'Reyansh', 'Aadhya',
  'Advik', 'Saanvi', 'Ishaan', 'Myra', 'Rohan',
  'Kiara', 'Dev', 'Tara', 'Neil', 'Sara',
  'Vivaan', 'Nisha', 'Krish', 'Aanya', 'Rahul',
];
const LAST_NAMES = [
  'Mehta', 'Sharma', 'Patel', 'Rao', 'Nair',
  'Kapoor', 'Joshi', 'Iyer', 'Desai', 'Kulkarni',
];
const DEPARTMENTS = [
  'Computer Engineering', 'Electronics', 'Mechanical Engineering',
  'Civil Engineering', 'Business Administration', 'Design',
];
const YEARS = ['First Year', 'Second Year', 'Third Year', 'Final Year'];
const CONDITIONS = ['good', 'like-new', 'fair', 'new', 'poor'];
const PRODUCT_TEMPLATES = [
  { title: 'Scientific calculator', category: 'Electronics', price: 950, details: { brand: 'Casio', model: 'fx-991ES Plus' } },
  { title: 'Engineering mathematics textbook', category: 'Books & Notes', price: 420, details: { edition: '44th', subject: 'Engineering Mathematics' } },
  { title: 'Adjustable laptop stand', category: 'Electronics', price: 850, details: { material: 'Aluminium', compatibility: '13 to 16 inch laptops' } },
  { title: 'Desk study lamp', category: 'Furniture', price: 600, details: { type: 'LED', features: 'Adjustable brightness' } },
  { title: 'Mechanical keyboard', category: 'Electronics', price: 2400, details: { layout: 'Compact', connection: 'USB-C' } },
  { title: 'Campus backpack', category: 'Bags & Stationery', price: 1100, details: { capacity: '24 litres', colour: 'Navy blue' } },
  { title: 'Drafting instrument set', category: 'Academic Equipment', price: 540, details: { pieces: '12', case: 'Included' } },
  { title: 'USB-C laptop hub', category: 'Electronics', price: 1250, details: { ports: 'HDMI, USB-A, SD card' } },
  { title: 'Cycle helmet', category: 'Cycles & Transport', price: 750, details: { size: 'Medium', colour: 'Matte black' } },
  { title: 'Badminton racket', category: 'Sports & Fitness', price: 1350, details: { grip: 'G4', cover: 'Included' } },
  { title: 'Project breadboard kit', category: 'Project Components', price: 380, details: { components: 'Breadboard, jumper wires, LEDs' } },
  { title: 'Laundry storage hamper', category: 'Furniture', price: 450, details: { material: 'Fabric', collapsible: 'Yes' } },
];
const IMAGE_URLS = [
  'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop',
];

function validateTarget({ uri, nodeEnv, execute, confirmedDatabase }) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB URL.');
  }

  const database = decodeURIComponent(parsed.pathname.slice(1).split('/')[0] || '');
  const host = parsed.hostname.toLowerCase();
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error('Test data seeding is allowed only when NODE_ENV is development or test.');
  }
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Refusing to seed a non-local MongoDB host (${host}).`);
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to seed database "${database || '(empty)'}"; expected "${EXPECTED_DATABASE}".`);
  }
  if (!execute || confirmedDatabase !== EXPECTED_DATABASE) {
    throw new Error(`To write data, pass --execute --confirm-database=${EXPECTED_DATABASE}.`);
  }
  return { host, database };
}

function buildUserSpecs(passwordHash) {
  return FIRST_NAMES.map((firstName, index) => {
    const number = String(index + 1).padStart(2, '0');
    const lastName = LAST_NAMES[index % LAST_NAMES.length];
    return {
      name: `${firstName} ${lastName} (Demo ${number})`,
      email: `demo.seed.${number}@campusmarket.test`,
      passwordHash,
      college: 'Campus Marketplace Demo University',
      collegeEmail: `student.${number}@campusmarket.test`,
      department: DEPARTMENTS[index % DEPARTMENTS.length],
      year: YEARS[index % YEARS.length],
      collegeVerified: false,
      role: 'student',
      isDemo: true,
    };
  });
}

function buildListingSpecs(users, categories) {
  const categoriesByName = new Map(categories.map((category) => [category.name, category]));
  const availableCategories = categories.filter((category) => category.isActive);
  if (!availableCategories.length) throw new Error('No active categories are available for test listings.');

  return Array.from({ length: LISTING_COUNT }, (_value, index) => {
    const number = String(index + 1).padStart(3, '0');
    const template = PRODUCT_TEMPLATES[index % PRODUCT_TEMPLATES.length];
    const seller = users[Math.floor(index / (LISTING_COUNT / USER_COUNT))];
    const category = categoriesByName.get(template.category);
    const actualCategory = category && category.isActive ? category : availableCategories[index % availableCategories.length];
    const condition = CONDITIONS[index % CONDITIONS.length];
    const listingType = index % 20 === 0 ? 'free' : index % 29 === 0 ? 'lost' : index % 31 === 0 ? 'found' : 'sale';
    const isNoPriceListing = listingType !== 'sale';

    return {
      title: `[DEMO ${number}] ${template.title}`,
      description: `${template.title} in ${condition} condition. Synthetic test listing for the Campus Marketplace interface; this is not a real item or offer.`,
      category: actualCategory._id,
      price: isNoPriceListing ? 0 : template.price + ((index % 5) * 75),
      condition,
      imageUrl: IMAGE_URLS[index % IMAGE_URLS.length],
      seller: seller._id,
      isDemo: true,
      location: `Demo campus, ${['North', 'South', 'East', 'West'][index % 4]} Block`,
      isExchangeable: index % 4 === 0,
      listingType,
      details: Object.fromEntries(Object.entries(template.details).map(([key, value]) => [key, String(value)])),
      tags: [...new Set([template.title.toLowerCase(), condition, 'demo', 'test-data', BATCH_TAG])].slice(0, 10),
      pickupLocation: 'Demo campus student centre',
      pickupAvailability: 'Weekdays, 10 AM–4 PM',
      lostFoundDate: listingType === 'lost' || listingType === 'found' ? new Date() : null,
      status: 'available',
    };
  });
}

async function seed() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const confirmation = args.find((arg) => arg.startsWith('--confirm-database='))
    ?.slice('--confirm-database='.length);
  const target = validateTarget({
    uri: config.db.uri,
    nodeEnv: config.env,
    execute,
    confirmedDatabase: confirmation,
  });

  await mongoose.connect(config.db.uri);
  try {
    const userSpecs = buildUserSpecs('preflight-only');
    const categories = await Category.find({ isActive: true }).lean();
    const titles = buildListingSpecs(
      Array.from({ length: USER_COUNT }, (_value, index) => ({ _id: `preflight-${index}` })),
      categories
    ).map((listing) => listing.title);
    const existingUsers = await User.find({ email: { $in: userSpecs.map((user) => user.email) } })
      .select('email isDemo').lean();
    const existingProducts = await Product.find({ title: { $in: titles } })
      .select('title isDemo').lean();
    const conflictingUser = existingUsers.find((user) => !user.isDemo);
    const conflictingProduct = existingProducts.find((product) => !product.isDemo);
    if (conflictingUser || conflictingProduct) {
      throw new Error('A generated demo identity collides with a non-demo record; no data was written.');
    }

    const existingUserEmails = new Set(existingUsers.map((user) => user.email));
    const existingProductTitles = new Set(existingProducts.map((product) => product.title));
    const newUserSpecs = userSpecs.filter((user) => !existingUserEmails.has(user.email));
    const password = newUserSpecs.length ? crypto.randomBytes(24).toString('base64url') : null;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const usersToCreate = buildUserSpecs(passwordHash || 'unused-hash')
      .filter((user) => !existingUserEmails.has(user.email))
      .map((user) => new User(user));

    await Promise.all(usersToCreate.map((user) => user.validate()));
    const allUsers = [...existingUsers, ...usersToCreate];
    const usersByEmail = new Map(allUsers.map((user) => [user.email, user]));
    const listingSpecs = buildListingSpecs(
      userSpecs.map((spec) => usersByEmail.get(spec.email)),
      categories
    ).filter((listing) => !existingProductTitles.has(listing.title));
    const listingsToCreate = listingSpecs.map((listing) => new Product(listing));

    try {
      await Promise.all(listingsToCreate.map((listing) => listing.validate()));
    } catch (error) {
      throw new Error(`Demo listing validation failed before product inserts: ${error.message}`);
    }

    if (usersToCreate.length) await User.insertMany(usersToCreate);
    if (listingsToCreate.length) await Product.insertMany(listingsToCreate);

    const [verifiedUsers, verifiedProducts] = await Promise.all([
      User.countDocuments({ email: { $in: userSpecs.map((user) => user.email) }, isDemo: true }),
      Product.countDocuments({ title: { $in: titles }, isDemo: true }),
    ]);
    if (verifiedUsers !== USER_COUNT || verifiedProducts !== LISTING_COUNT) {
      throw new Error(`Post-seed verification expected ${USER_COUNT} users/${LISTING_COUNT} listings; found ${verifiedUsers}/${verifiedProducts}.`);
    }

    console.log(`Seeded database ${target.database} on ${target.host}.`);
    console.log(`Verified ${verifiedUsers} demo users and ${verifiedProducts} demo listings; existing records were not modified or deleted.`);
    if (newUserSpecs.length) {
      console.log(`Shared password for newly created demo accounts: ${password}`);
      console.log('New demo usernames:');
      newUserSpecs.forEach((user) => console.log(user.email));
    } else {
      console.log('All demo accounts already existed; no new account passwords were generated.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seed().catch((error) => {
    console.error(`Test-data seeding failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { validateTarget, buildUserSpecs, buildListingSpecs, USER_COUNT, LISTING_COUNT };
