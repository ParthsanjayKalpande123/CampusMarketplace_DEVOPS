'use strict';

/**
 * tests/integration/admin.test.js
 *
 * Integration tests for admin-only API endpoints.
 * Tests cover: stats, user management, report management.
 */

process.env.NODE_ENV         = 'test';
process.env.MONGODB_URI      = 'mongodb://localhost:27017/campus_marketplace_test';
process.env.JWT_SECRET       = 'admin-test-jwt-secret-long-enough-32chars!!';
process.env.JWT_EXPIRES_IN   = '1h';
process.env.COOKIE_SECURE    = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.LOG_LEVEL        = 'error';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../../src/app');
const User     = require('../../src/models/User');
const Product  = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const Report   = require('../../src/models/Report');
const bcrypt   = require('bcrypt');

const BASE = '/api/v1/admin';

// ------------------------------------------------------------------
// DB lifecycle
// ------------------------------------------------------------------

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Report.deleteMany({}),
  ]);
});

afterAll(async () => {
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Report.deleteMany({}),
  ]);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function createUser(role = 'student', email = 'user@test.com', name = 'Test User') {
  const passwordHash = await bcrypt.hash('TestPass123', 1);
  return User.create({ name, email, passwordHash, role });
}

async function loginUser(email = 'user@test.com', password = 'TestPass123') {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return res.headers['set-cookie'];
}

async function createAdminAndLogin() {
  await createUser('admin', 'admin@test.com', 'Admin User');
  return loginUser('admin@test.com');
}

async function createCategory(name = 'Electronics') {
  return Category.create({ name, isActive: true });
}

async function createProduct(sellerId, categoryId, title = 'Test Item') {
  return Product.create({
    title,
    description: 'A test product description here.',
    category:    categoryId,
    price:       500,
    condition:   'good',
    seller:      sellerId,
    status:      'available',
  });
}

// ==================================================================
// GET /api/v1/admin/stats
// ==================================================================

describe('GET /api/v1/admin/stats', () => {
  it('should return aggregate stats for admin', async () => {
    const cookies = await createAdminAndLogin();
    await createUser('student', 's1@test.com');

    const res = await request(app)
      .get(`${BASE}/stats`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalUsers');
    expect(res.body.data).toHaveProperty('totalProducts');
    expect(res.body.data).toHaveProperty('availableProducts');
    expect(res.body.data).toHaveProperty('pendingReports');
    expect(res.body.data).toHaveProperty('totalReports');
    expect(res.body.data.totalUsers).toBe(2); // admin + student
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get(`${BASE}/stats`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for a non-admin user', async () => {
    await createUser('student', 's@test.com');
    const cookies = await loginUser('s@test.com');

    const res = await request(app)
      .get(`${BASE}/stats`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });
});

// ==================================================================
// GET /api/v1/admin/users
// ==================================================================

describe('GET /api/v1/admin/users', () => {
  it('should return paginated list of all users', async () => {
    const cookies = await createAdminAndLogin();
    await createUser('student', 's1@test.com', 'Student One');
    await createUser('student', 's2@test.com', 'Student Two');

    const res = await request(app)
      .get(`${BASE}/users`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(3); // admin + 2 students
    expect(res.body.data.pagination).toHaveProperty('total', 3);
  });

  it('should filter users by role', async () => {
    const cookies = await createAdminAndLogin();
    await createUser('student', 's@test.com');

    const res = await request(app)
      .get(`${BASE}/users`)
      .query({ role: 'admin' })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].role).toBe('admin');
  });

  it('should search users by name', async () => {
    const cookies = await createAdminAndLogin();
    await createUser('student', 's@test.com', 'Rahul Sharma');

    const res = await request(app)
      .get(`${BASE}/users`)
      .query({ q: 'rahul' })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Rahul Sharma');
  });

  it('should never return passwordHash', async () => {
    const cookies = await createAdminAndLogin();

    const res = await request(app)
      .get(`${BASE}/users`)
      .set('Cookie', cookies);

    res.body.data.items.forEach(u => {
      expect(u).not.toHaveProperty('passwordHash');
    });
  });
});

// ==================================================================
// PATCH /api/v1/admin/users/:id/role
// ==================================================================

describe('PATCH /api/v1/admin/users/:id/role', () => {
  it('should allow admin to promote a student to admin', async () => {
    const cookies = await createAdminAndLogin();
    const student = await createUser('student', 's@test.com');

    const res = await request(app)
      .patch(`${BASE}/users/${student._id}/role`)
      .set('Cookie', cookies)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('should allow admin to demote another admin to student', async () => {
    const cookies = await createAdminAndLogin();
    const other   = await createUser('admin', 'admin2@test.com', 'Other Admin');

    const res = await request(app)
      .patch(`${BASE}/users/${other._id}/role`)
      .set('Cookie', cookies)
      .send({ role: 'student' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('student');
  });

  it('should return 400 if admin tries to change their own role', async () => {
    const admin   = await createUser('admin', 'admin@test.com', 'Admin');
    const cookies = await loginUser('admin@test.com');

    const res = await request(app)
      .patch(`${BASE}/users/${admin._id}/role`)
      .set('Cookie', cookies)
      .send({ role: 'student' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_ROLE_CHANGE');
  });

  it('should return 400 for an invalid role value', async () => {
    const cookies = await createAdminAndLogin();
    const student = await createUser('student', 's@test.com');

    const res = await request(app)
      .patch(`${BASE}/users/${student._id}/role`)
      .set('Cookie', cookies)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for a non-existent user', async () => {
    const cookies = await createAdminAndLogin();
    const fakeId  = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`${BASE}/users/${fakeId}/role`)
      .set('Cookie', cookies)
      .send({ role: 'student' });

    expect(res.status).toBe(404);
  });
});

// ==================================================================
// GET /api/v1/admin/reports
// ==================================================================

describe('GET /api/v1/admin/reports', () => {
  it('should return all reports for admin', async () => {
    const admin   = await createUser('admin', 'admin@test.com', 'Admin');
    const student = await createUser('student', 's@test.com');
    const cookies = await loginUser('admin@test.com');
    const cat     = await createCategory();
    const product = await createProduct(student._id, cat._id);
    await Report.create({ product: product._id, reportedBy: admin._id, reason: 'spam' });

    const res = await request(app)
      .get(`${BASE}/reports`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].reason).toBe('spam');
  });

  it('should return 403 for non-admin', async () => {
    await createUser('student', 's@test.com');
    const cookies = await loginUser('s@test.com');

    const res = await request(app)
      .get(`${BASE}/reports`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });
});

// ==================================================================
// PATCH /api/v1/admin/reports/:id/status
// ==================================================================

describe('PATCH /api/v1/admin/reports/:id/status', () => {
  it('should allow admin to mark a report as reviewed', async () => {
    const admin   = await createUser('admin', 'admin@test.com', 'Admin');
    const student = await createUser('student', 's@test.com');
    const cookies = await loginUser('admin@test.com');
    const cat     = await createCategory();
    const product = await createProduct(student._id, cat._id);
    const report  = await Report.create({ product: product._id, reportedBy: admin._id, reason: 'spam' });

    const res = await request(app)
      .patch(`${BASE}/reports/${report._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'reviewed' });

    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe('reviewed');
  });

  it('should allow admin to mark a report as resolved', async () => {
    const admin   = await createUser('admin', 'admin@test.com', 'Admin');
    const student = await createUser('student', 's@test.com');
    const cookies = await loginUser('admin@test.com');
    const cat     = await createCategory();
    const product = await createProduct(student._id, cat._id);
    const report  = await Report.create({ product: product._id, reportedBy: admin._id, reason: 'fraud' });

    const res = await request(app)
      .patch(`${BASE}/reports/${report._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe('resolved');
  });

  it('should return 400 for an invalid status value', async () => {
    const admin   = await createUser('admin', 'admin@test.com', 'Admin');
    const student = await createUser('student', 's@test.com');
    const cookies = await loginUser('admin@test.com');
    const cat     = await createCategory();
    const product = await createProduct(student._id, cat._id);
    const report  = await Report.create({ product: product._id, reportedBy: admin._id, reason: 'spam' });

    const res = await request(app)
      .patch(`${BASE}/reports/${report._id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'deleted' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for a non-existent report', async () => {
    const cookies = await createAdminAndLogin();
    const fakeId  = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`${BASE}/reports/${fakeId}/status`)
      .set('Cookie', cookies)
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});
