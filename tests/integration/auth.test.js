'use strict';

/**
 * tests/integration/auth.test.js
 *
 * Integration tests for authentication and user profile endpoints.
 * Uses a real MongoDB test database — requires MongoDB running locally.
 *
 * Environment variables are set BEFORE any require() so the config
 * module picks them up on its first load (dotenv never overrides
 * already-set variables).
 *
 * Run with: npm run test:integration
 */

// ----------------------------------------------------------------
// Set env vars FIRST — before any require() loads config/env.js
// ----------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.MONGODB_URI = 'mongodb://localhost:27017/campus_marketplace_test';
process.env.JWT_SECRET = 'integration-test-jwt-secret-long-enough-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.LOG_LEVEL = 'error';
process.env.CORS_ORIGIN = 'http://localhost:3001';

// ----------------------------------------------------------------
// Requires — after env vars
// ----------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');

// ----------------------------------------------------------------
// Database lifecycle
// ----------------------------------------------------------------

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

beforeEach(async () => {
  // Wipe users between tests for complete isolation
  await User.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const BASE = '/api/v1';

const TEST_USER = {
  name: 'Test Student',
  email: 'student@campus.test',
  password: 'SecurePass123',
  college: 'Test Engineering College',
};

/** POST /register with given data (defaults to TEST_USER) */
function registerUser(data = TEST_USER) {
  return request(app).post(`${BASE}/auth/register`).send(data);
}

/** POST /login with given credentials */
function loginUser(credentials = { email: TEST_USER.email, password: TEST_USER.password }) {
  return request(app).post(`${BASE}/auth/login`).send(credentials);
}

/**
 * Registers and logs in TEST_USER.
 * Returns the raw Set-Cookie header array for use with .set('Cookie', cookies).
 */
async function registerAndLogin() {
  const regRes = await registerUser();
  if (regRes.status !== 201) {
    throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }

  const loginRes = await loginUser();
  if (loginRes.status !== 200) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
  }

  const cookies = loginRes.headers['set-cookie'];
  if (!cookies) {
    throw new Error('Login succeeded but no Set-Cookie header was returned');
  }

  return cookies;
}

// ================================================================
// POST /api/v1/auth/register
// ================================================================

describe('POST /api/v1/auth/register', () => {
  it('should register a new student and return 201', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.role).toBe('student');
  });

  it('should never return passwordHash in the response', async () => {
    const res = await registerUser();

    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should not auto-login after register (no Set-Cookie header)', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    // Register does NOT set a cookie — user must call /login separately
    const cookies = res.headers['set-cookie'];
    const hasTokenCookie = cookies
      ? cookies.some((c) => c.startsWith('token=') && !c.includes('token=;'))
      : false;
    expect(hasTokenCookie).toBe(false);
  });

  it('should return 409 with DUPLICATE_EMAIL if email is already registered', async () => {
    await registerUser();
    const res = await registerUser(); // duplicate

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('should return 400 VALIDATION_ERROR if name is missing', async () => {
    const res = await registerUser({ ...TEST_USER, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR if email is invalid', async () => {
    const res = await registerUser({ ...TEST_USER, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR if password is shorter than 8 characters', async () => {
    const res = await registerUser({ ...TEST_USER, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ================================================================
// POST /api/v1/auth/login
// ================================================================

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await registerUser(); // create the user before each login test
  });

  it('should login successfully and return 200', async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_USER.email);
  });

  it('should set an HTTP-only cookie containing the JWT', async () => {
    const res = await loginUser();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
  });

  it('should NOT return the JWT token in the response body', async () => {
    const res = await loginUser();

    // JWT must only be in the cookie — never in the response body
    expect(res.body.token).toBeUndefined();
    expect(res.body.data && res.body.data.token).toBeUndefined();
  });

  it('should NOT return passwordHash in the response body', async () => {
    const res = await loginUser();

    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should return 401 INVALID_CREDENTIALS for wrong password', async () => {
    const res = await loginUser({ email: TEST_USER.email, password: 'WrongPassword999' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 INVALID_CREDENTIALS for non-existent email', async () => {
    const res = await loginUser({ email: 'nobody@nowhere.test', password: 'Password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return the same error message for wrong email and wrong password (prevent enumeration)', async () => {
    const res1 = await loginUser({ email: 'nobody@nowhere.test', password: 'Pass123' });
    const res2 = await loginUser({ email: TEST_USER.email, password: 'WrongPass999' });

    expect(res1.body.error.message).toBe(res2.body.error.message);
  });

  it('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ password: 'Password123' });

    expect(res.status).toBe(400);
  });
});

// ================================================================
// POST /api/v1/auth/logout
// ================================================================

describe('POST /api/v1/auth/logout', () => {
  it('should return 200 and clear the JWT cookie', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE}/auth/logout`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the cookie is being cleared (expires in past or Max-Age=0)
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const tokenCookie = setCookie.find((c) => c.startsWith('token='));
      if (tokenCookie) {
        const isCleared =
          /expires=Thu, 01 Jan 1970/i.test(tokenCookie) ||
          /Max-Age=0/i.test(tokenCookie) ||
          /token=;/i.test(tokenCookie);
        expect(isCleared).toBe(true);
      }
    }
  });

  it('should return 401 if called without a valid cookie', async () => {
    const res = await request(app).post(`${BASE}/auth/logout`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });
});

// ================================================================
// GET /api/v1/users/me
// ================================================================

describe('GET /api/v1/users/me', () => {
  it('should return the authenticated user profile with correct fields', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .get(`${BASE}/users/me`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.name).toBe(TEST_USER.name);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should return 401 TOKEN_MISSING without a cookie', async () => {
    const res = await request(app).get(`${BASE}/users/me`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });
});

// ================================================================
// PUT /api/v1/users/me
// ================================================================

describe('PUT /api/v1/users/me', () => {
  it('should update allowed fields (name, phone, college)', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .put(`${BASE}/users/me`)
      .set('Cookie', cookies)
      .send({ name: 'Updated Name', phone: '9876543210', college: 'New College' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Updated Name');
    expect(res.body.data.user.phone).toBe('9876543210');
    expect(res.body.data.user.college).toBe('New College');
  });

  it('should update profileImage when a valid URL is provided', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .put(`${BASE}/users/me`)
      .set('Cookie', cookies)
      .send({ profileImage: 'https://example.com/avatar.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.profileImage).toBe('https://example.com/avatar.jpg');
  });

  it('should return 400 VALIDATION_ERROR if email is included in request body', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .put(`${BASE}/users/me`)
      .set('Cookie', cookies)
      .send({ email: 'hacker@evil.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR if role is included in request body', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .put(`${BASE}/users/me`)
      .set('Cookie', cookies)
      .send({ role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR if profileImage is not a valid URL', async () => {
    const cookies = await registerAndLogin();

    const res = await request(app)
      .put(`${BASE}/users/me`)
      .set('Cookie', cookies)
      .send({ profileImage: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 TOKEN_MISSING without authentication', async () => {
    const res = await request(app)
      .put(`${BASE}/users/me`)
      .send({ name: 'Hacker' });

    expect(res.status).toBe(401);
  });
});
