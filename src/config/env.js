'use strict';

/**
 * src/config/env.js
 *
 * Loads environment variables from .env (non-production only) and
 * validates that all required variables are present. Exports a
 * strongly-typed config object that the rest of the application uses.
 *
 * Rule: No other file in the codebase should read process.env directly.
 *       All configuration must come from this module.
 */

const dotenv = require('dotenv');

// In production, environment variables are injected by Docker / Ansible.
// In development/test, they are loaded from the .env file.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Variables that MUST be present for each environment.
const REQUIRED_VARS = {
  production: ['MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN'],
  development: ['MONGODB_URI'],
  test: [],
};

/**
 * Validates required environment variables.
 * Called once at server startup — throws on any violation.
 */
function validateEnv() {
  const env = process.env.NODE_ENV || 'development';
  const required = REQUIRED_VARS[env] || REQUIRED_VARS.development;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[Config] Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill in the values.`
    );
  }

  // Enforce a minimum-length JWT secret in production to prevent weak tokens.
  if (env === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('[Config] JWT_SECRET must be at least 32 characters long in production.');
    }
  }
}

/**
 * Typed configuration object.
 * Import this everywhere instead of using process.env directly.
 */
const config = {
  /** Current runtime environment */
  env: process.env.NODE_ENV || 'development',

  /** HTTP port the Express server listens on */
  port: parseInt(process.env.PORT, 10) || 3000,

  app: {
    name: process.env.APP_NAME || 'Campus Marketplace',
  },

  db: {
    /** Full MongoDB connection URI — must never be localhost in Docker */
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_marketplace',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'insecure-default-dev-secret-do-not-use-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cookie: {
    /** Must be true in production (requires HTTPS) */
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    /** 7 days in milliseconds */
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Convenience flags — avoid comparing strings elsewhere
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  isTest: process.env.NODE_ENV === 'test',
};

module.exports = { config, validateEnv };
