'use strict';

/**
 * tests/integration/category.test.js
 *
 * Integration tests for category endpoints.
 * Covers: public listing, admin-only creation, seeding behaviour.
 */

process.env.NODE_ENV         = 'test';
process.env.MONGODB_URI      = 'mongodb://localhost:27017/campus_marketplace_test';
process.env.JWT_SECRET       = 'category-test-jwt-secret-long-enough-32chars';
process.env.JWT_EXPIRES_IN   = '1h';
process.env.COOKIE_SECURE    = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.LOG_LEVEL        = 'error';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../src/app');
const User     = require('../../src/models/User');
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
  await Category.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await Category.deleteMany({});
  await User.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function createUser(role = 'student', email = 'user@test.com') {
  const passwordHash = await bcrypt.hash('TestPass123', 1);
  return User.create({ name: 'Test User', email, passwordHash, role });
}

async function loginUser(email = 'user@test.com') {
  const res = await request(app)
    .post(`${BASE}/auth/login`)
    .send({ email, password: 'TestPass123' });
  return res.headers['set-cookie'];
}

async function createAndLogin(role = 'student', email = 'user@test.com') {
  await createUser(role, email);
  return loginUser(email);
}

// ==================================================================
// GET /api/v1/categories
// ==================================================================

describe('GET /api/v1/categories', () => {
  it('should return an empty list when no categories exist', async () => {
    const res = await request(app).get(`${BASE}/categories`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories).toHaveLength(0);
  });

  it('should return only active categories', async () => {
    await Category.create([
      { name: 'Active Cat',   isActive: true  },
      { name: 'Inactive Cat', isActive: false },
    ]);

    const res = await request(app).get(`${BASE}/categories`);

    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].name).toBe('Active Cat');
  });

  it('should return categories sorted alphabetically', async () => {
    await Category.create([
      { name: 'Zebra', isActive: true },
      { name: 'Apple', isActive: true },
      { name: 'Mango', isActive: true },
    ]);

    const res = await request(app).get(`${BASE}/categories`);

    expect(res.status).toBe(200);
    const names = res.body.data.categories.map((c) => c.name);
    expect(names).toEqual([...names].sort());
  });

  it('should be accessible without authentication', async () => {
    const res = await request(app).get(`${BASE}/categories`);
    expect(res.status).toBe(200);
  });
});

// ==================================================================
// POST /api/v1/categories (admin only)
// ==================================================================

describe('POST /api/v1/categories', () => {
  it('should allow an admin to create a category', async () => {
    const cookies = await createAndLogin('admin', 'admin@test.com');

    const res = await request(app)
      .post(`${BASE}/categories`)
      .set('Cookie', cookies)
      .send({ name: 'Lab Equipment', description: 'Scientific tools.' });

    expect(res.status).toBe(201);
    expect(res.body.data.category.name).toBe('Lab Equipment');
    expect(res.body.data.category.isActive).toBe(true);
  });

  it('should return 403 if a student tries to create a category', async () => {
    const cookies = await createAndLogin('student', 'student@test.com');

    const res = await request(app)
      .post(`${BASE}/categories`)
      .set('Cookie', cookies)
      .send({ name: 'New Category' });

    expect(res.status).toBe(403);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app)
      .post(`${BASE}/categories`)
      .send({ name: 'New Category' });

    expect(res.status).toBe(401);
  });

  it('should return 400 if name is missing', async () => {
    const cookies = await createAndLogin('admin', 'admin@test.com');

    const res = await request(app)
      .post(`${BASE}/categories`)
      .set('Cookie', cookies)
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ==================================================================
// PATCH /api/v1/categories/:id (admin only)
// ==================================================================

describe('PATCH /api/v1/categories/:id', () => {
  it('should allow an admin to update a category', async () => {
    const cat     = await Category.create({ name: 'Old Name', isActive: true });
    const cookies = await createAndLogin('admin', 'admin@test.com');

    const res = await request(app)
      .patch(`${BASE}/categories/${cat._id}`)
      .set('Cookie', cookies)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('New Name');
  });

  it('should allow an admin to deactivate a category', async () => {
    const cat     = await Category.create({ name: 'Active', isActive: true });
    const cookies = await createAndLogin('admin', 'admin@test.com');

    const res = await request(app)
      .patch(`${BASE}/categories/${cat._id}`)
      .set('Cookie', cookies)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.category.isActive).toBe(false);
  });

  it('should return 403 if a student tries to update a category', async () => {
    const cat     = await Category.create({ name: 'Test', isActive: true });
    const cookies = await createAndLogin('student', 'student@test.com');

    const res = await request(app)
      .patch(`${BASE}/categories/${cat._id}`)
      .set('Cookie', cookies)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should return 404 for a non-existent category', async () => {
    const fakeId  = new mongoose.Types.ObjectId().toString();
    const cookies = await createAndLogin('admin', 'admin@test.com');

    const res = await request(app)
      .patch(`${BASE}/categories/${fakeId}`)
      .set('Cookie', cookies)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});
