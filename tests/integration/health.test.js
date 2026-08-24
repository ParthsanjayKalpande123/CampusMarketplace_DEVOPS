'use strict';

/**
 * tests/integration/health.test.js
 *
 * Integration tests for the health and readiness endpoints.
 * These tests run against the real Express app with a real MongoDB connection.
 *
 * Run with: npm run test:integration
 */

// Set env vars before any require() loads config/env.js
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/campus_marketplace_test';
process.env.JWT_SECRET = 'health-test-jwt-secret-long-enough-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');

describe('Health Endpoints', () => {
  describe('Development local requests', () => {
    it('should not throttle local development requests with a 429 during normal bursts', async () => {
      jest.resetModules();

      process.env.NODE_ENV = 'development';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/campus_marketplace_dev';
      process.env.JWT_SECRET = 'development-test-jwt-secret-long-enough-32chars';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.COOKIE_SECURE = 'false';
      process.env.LOG_LEVEL = 'error';

      const devApp = require('../../src/app');

      for (let i = 0; i < 350; i += 1) {
        const res = await request(devApp).get('/login');
        if (res.status === 429) {
          expect(res.status).not.toBe(429);
          return;
        }
      }

      const res = await request(devApp).get('/login');
      expect(res.status).not.toBe(429);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/v1/health — Liveness probe
  // ------------------------------------------------------------------
  describe('GET /api/v1/health', () => {
    it('should return 200 with healthy status regardless of DB state', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('service');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return a valid ISO 8601 timestamp', async () => {
      const res = await request(app).get('/api/v1/health');
      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.toISOString()).toBe(res.body.timestamp);
    });

    it('should include the application name in the service field', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(typeof res.body.service).toBe('string');
      expect(res.body.service.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/v1/ready — Readiness probe
  // ------------------------------------------------------------------
  describe('GET /api/v1/ready', () => {
    describe('when MongoDB is disconnected', () => {
      beforeAll(async () => {
        // Force-disconnect mongoose for this test block
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      });

      it('should return 503 with not_ready status', async () => {
        const res = await request(app).get('/api/v1/ready');

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.status).toBe('not_ready');
        expect(res.body.checks).toHaveProperty('mongodb');
        expect(res.body.checks.mongodb).not.toBe('connected');
      });
    });

    describe('when MongoDB is connected', () => {
      beforeAll(async () => {
        // Reconnect for this test block
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(
            process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_marketplace_test'
          );
        }
      });

      afterAll(async () => {
        // Clean up connection after tests
        await mongoose.disconnect();
      });

      it('should return 200 with ready status', async () => {
        const res = await request(app).get('/api/v1/ready');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('ready');
        expect(res.body.checks.mongodb).toBe('connected');
      });

      it('should include a valid ISO 8601 timestamp', async () => {
        const res = await request(app).get('/api/v1/ready');
        const timestamp = new Date(res.body.timestamp);
        expect(timestamp.toISOString()).toBe(res.body.timestamp);
      });
    });
  });

  // ------------------------------------------------------------------
  // 404 handling for unknown API routes
  // ------------------------------------------------------------------
  describe('Unknown API Routes', () => {
    it('should return 404 JSON for unknown /api/v1/* routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route-xyz');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});
