'use strict';

/**
 * tests/integration/product.test.js
 *
 * Integration tests for product listing CRUD endpoints.
 * Requires MongoDB running locally.
 */

// Set env vars before all requires
process.env.NODE_ENV    = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/campus_marketplace_test';
process.env.JWT_SECRET  = 'product-test-jwt-secret-long-enough-32chars';
process.env.JWT_EXPIRES_IN  = '1h';
process.env.COOKIE_SECURE   = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.LOG_LEVEL = 'error';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../src/app');
const User     = require('../../src/models/User');
const Product  = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const bcrypt   = require('bcrypt');

const BASE = '/api/v1';

// ------------------------------------------------------------------
// DB lifecycle
// ------------------------------------------------------------------

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

beforeEach(async () => {
  await Product.deleteMany({});
  await User.deleteMany({});
  await Category.deleteMany({});
});

afterAll(async () => {
  await Product.deleteMany({});
  await User.deleteMany({});
  await Category.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('TestPass123', 1);
  return User.create({
    name:         overrides.name         || 'Test Student',
    email:        overrides.email        || 'student@test.com',
    passwordHash,
    role:         overrides.role         || 'student',
    college:      overrides.college      || 'Test College',
  });
}

async function loginUser(email = 'student@test.com', password = 'TestPass123') {
  const res = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ email, password });
  return res.headers['set-cookie'];
}

async function createAndLogin(overrides = {}) {
  await createUser(overrides);
  return loginUser(overrides.email || 'student@test.com');
}

async function createCategory(name = 'Electronics') {
  return Category.create({ name, description: 'Test category', isActive: true });
}

async function createProduct(sellerId, categoryId, overrides = {}) {
  return Product.create({
    title:       overrides.title       || 'Used Laptop',
    description: overrides.description || 'A barely used laptop in good condition.',
    category:    categoryId,
    price:       overrides.price       ?? 8000,
    condition:   overrides.condition   || 'good',
    seller:      sellerId,
    status:      overrides.status      || 'available',
  });
}

// ==================================================================
// GET /api/v1/products
// ==================================================================

describe('GET /api/v1/products', () => {
  it('should return an empty list when no products exist', async () => {
    const res = await request(app).get(`${BASE}/products`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('should return only available products by default', async () => {
    const user = await createUser();
    const cat  = await createCategory();
    await createProduct(user._id, cat._id, { status: 'available' });
    await createProduct(user._id, cat._id, { title: 'Sold Item', status: 'sold' });

    const res = await request(app).get(`${BASE}/products`);

    expect(res.status).toBe(200);
    // Only 1 available product visible
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('available');
  });

  it('should filter products by category', async () => {
    const user   = await createUser();
    const catA   = await createCategory('Electronics');
    const catB   = await createCategory('Books & Notes');
    await createProduct(user._id, catA._id);
    await createProduct(user._id, catB._id, { title: 'Physics Book' });

    const res = await request(app)
      .get(`${BASE}/products`)
      .query({ category: catA._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('Used Laptop');
  });

  it('should filter products by price range', async () => {
    const user = await createUser();
    const cat  = await createCategory();
    await createProduct(user._id, cat._id, { price: 500 });
    await createProduct(user._id, cat._id, { title: 'Expensive', price: 50000 });

    const res = await request(app)
      .get(`${BASE}/products`)
      .query({ minPrice: 0, maxPrice: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].price).toBe(500);
  });

  it('should filter products by text search on title', async () => {
    const user = await createUser();
    const cat  = await createCategory();
    await createProduct(user._id, cat._id, { title: 'Arduino Uno Kit' });
    await createProduct(user._id, cat._id, { title: 'Old Textbook' });

    const res = await request(app).get(`${BASE}/products`).query({ q: 'arduino' });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('Arduino Uno Kit');
  });

  it('should respect pagination (page and limit)', async () => {
    const user = await createUser();
    const cat  = await createCategory();
    // Create 3 products
    await Promise.all([
      createProduct(user._id, cat._id, { title: 'Item 1' }),
      createProduct(user._id, cat._id, { title: 'Item 2' }),
      createProduct(user._id, cat._id, { title: 'Item 3' }),
    ]);

    const res = await request(app)
      .get(`${BASE}/products`)
      .query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
  });
});

// ==================================================================
// POST /api/v1/products
// ==================================================================

describe('POST /api/v1/products', () => {
  it('should create a product and return 201', async () => {
    const cookies = await createAndLogin();
    const cat     = await createCategory();

    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Cookie', cookies)
      .send({
        title:       'Used Calculator',
        description: 'Scientific calculator in excellent condition.',
        category:    cat._id.toString(),
        price:       350,
        condition:   'like-new',
        location:    'Hostel A',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product.title).toBe('Used Calculator');
    expect(res.body.data.product.status).toBe('available');
    expect(res.body.data.product.seller).toHaveProperty('name');
    expect(res.body.data.product.category).toHaveProperty('name');
  });

  it('should set seller to the authenticated user', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();

    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Cookie', cookies)
      .send({
        title:       'My Item',
        description: 'Description that is long enough.',
        category:    cat._id.toString(),
        price:       100,
        condition:   'good',
      });

    expect(res.status).toBe(201);
    // seller._id in populated response matches logged-in user
    expect(res.body.data.product.seller._id).toBe(user._id.toString());
  });

  it('should return 400 if required fields are missing', async () => {
    const cookies = await createAndLogin();

    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Cookie', cookies)
      .send({ title: 'Incomplete' }); // missing many required fields

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 if price is negative', async () => {
    const cookies = await createAndLogin();
    const cat     = await createCategory();

    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Cookie', cookies)
      .send({
        title: 'Bad', description: 'Ten chars ok.', category: cat._id.toString(),
        price: -100, condition: 'good',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 if category does not exist', async () => {
    const cookies = await createAndLogin();
    const fakeId  = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`${BASE}/products`)
      .set('Cookie', cookies)
      .send({
        title: 'No Cat', description: 'Description long enough.', category: fakeId,
        price: 100, condition: 'good',
      });

    expect(res.status).toBe(404);
  });

  it('should return 401 if not authenticated', async () => {
    const cat = await createCategory();
    const res = await request(app)
      .post(`${BASE}/products`)
      .send({
        title: 'Test', description: 'Test description.', category: cat._id.toString(),
        price: 100, condition: 'good',
      });

    expect(res.status).toBe(401);
  });
});

// ==================================================================
// GET /api/v1/products/:id
// ==================================================================

describe('GET /api/v1/products/:id', () => {
  it('should return a product with populated seller and category', async () => {
    const user    = await createUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app).get(`${BASE}/products/${product._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.product._id).toBe(product._id.toString());
    expect(res.body.data.product.seller).toHaveProperty('name');
    expect(res.body.data.product.category).toHaveProperty('name');
  });

  it('should return 404 for a non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res    = await request(app).get(`${BASE}/products/${fakeId}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for an invalid product ID format', async () => {
    const res = await request(app).get(`${BASE}/products/not-a-mongo-id`);

    expect(res.status).toBe(400); // CastError → 400
  });
});

// ==================================================================
// GET /api/v1/products/my
// ==================================================================

describe('GET /api/v1/products/my', () => {
  it('should return only the authenticated user\'s own listings', async () => {
    const userA = await createUser({ email: 'a@test.com' });
    const userB = await createUser({ email: 'b@test.com', name: 'User B' });
    const cat   = await createCategory();

    await createProduct(userA._id, cat._id, { title: 'UserA Item' });
    await createProduct(userB._id, cat._id, { title: 'UserB Item' });

    const cookies = await loginUser('a@test.com');
    const res     = await request(app).get(`${BASE}/products/my`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].title).toBe('UserA Item');
  });

  it('should return all statuses for own listings (not just available)', async () => {
    const user    = await createUser();
    const cat     = await createCategory();
    await createProduct(user._id, cat._id, { status: 'available' });
    await createProduct(user._id, cat._id, { title: 'Sold', status: 'sold' });

    const cookies = await loginUser();
    const res     = await request(app).get(`${BASE}/products/my`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get(`${BASE}/products/my`);
    expect(res.status).toBe(401);
  });
});

// ==================================================================
// PUT /api/v1/products/:id
// ==================================================================

describe('PUT /api/v1/products/:id', () => {
  it('should allow the seller to update their listing', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .put(`${BASE}/products/${product._id}`)
      .set('Cookie', cookies)
      .send({ title: 'Updated Title', price: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.data.product.title).toBe('Updated Title');
    expect(res.body.data.product.price).toBe(5000);
  });

  it('should return 403 if a different user tries to update', async () => {
    const owner   = await createUser({ email: 'owner@test.com' });
    const other   = await createUser({ email: 'other@test.com', name: 'Other' });
    const cat     = await createCategory();
    const product = await createProduct(owner._id, cat._id);

    const cookies = await loginUser('other@test.com');
    const res     = await request(app)
      .put(`${BASE}/products/${product._id}`)
      .set('Cookie', cookies)
      .send({ title: 'Hijacked Title' });

    expect(res.status).toBe(403);
  });

  it('should return 400 if status is included in update body', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .put(`${BASE}/products/${product._id}`)
      .set('Cookie', cookies)
      .send({ status: 'sold' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 without authentication', async () => {
    const user    = await createUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .put(`${BASE}/products/${product._id}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(401);
  });
});

// ==================================================================
// PATCH /api/v1/products/:id/status
// ==================================================================

describe('PATCH /api/v1/products/:id/status', () => {
  it('should allow the seller to update the status', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .patch(`${BASE}/products/${product._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'sold' });

    expect(res.status).toBe(200);
    expect(res.body.data.product.status).toBe('sold');
  });

  it('should return 400 for an invalid status value', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .patch(`${BASE}/products/${product._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'deleted' }); // not a valid status

    expect(res.status).toBe(400);
  });

  it('should return 403 if a different user tries to update status', async () => {
    const owner   = await createUser({ email: 'owner@test.com' });
    const other   = await createUser({ email: 'other@test.com', name: 'Other' });
    const cat     = await createCategory();
    const product = await createProduct(owner._id, cat._id);

    const cookies = await loginUser('other@test.com');
    const res     = await request(app)
      .patch(`${BASE}/products/${product._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'sold' });

    expect(res.status).toBe(403);
  });
});

// ==================================================================
// DELETE /api/v1/products/:id
// ==================================================================

describe('DELETE /api/v1/products/:id', () => {
  it('should allow the seller to delete their listing and return 204', async () => {
    const user    = await createUser();
    const cookies = await loginUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app)
      .delete(`${BASE}/products/${product._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(204);

    // Verify product is actually gone
    const deleted = await Product.findById(product._id);
    expect(deleted).toBeNull();
  });

  it('should return 403 if a different user tries to delete', async () => {
    const owner   = await createUser({ email: 'owner@test.com' });
    const other   = await createUser({ email: 'other@test.com', name: 'Other' });
    const cat     = await createCategory();
    const product = await createProduct(owner._id, cat._id);

    const cookies = await loginUser('other@test.com');
    const res     = await request(app)
      .delete(`${BASE}/products/${product._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });

  it('should return 401 without authentication', async () => {
    const user    = await createUser();
    const cat     = await createCategory();
    const product = await createProduct(user._id, cat._id);

    const res = await request(app).delete(`${BASE}/products/${product._id}`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a non-existent product', async () => {
    // Create user so loadProduct can be reached — but product doesn't exist
    const cookies = await createAndLogin();
    const fakeId  = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`${BASE}/products/${fakeId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
  });
});
