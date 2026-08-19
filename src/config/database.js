'use strict';

/**
 * src/config/database.js
 *
 * Manages the Mongoose connection lifecycle.
 * The MONGODB_URI must always come from the environment variable —
 * never hardcode localhost or any hostname here.
 *
 * Connection hostname in Docker Compose will be the service name 'mongodb',
 * not localhost. This is enforced by always using process.env.MONGODB_URI
 * (read via config.db.uri).
 */

const mongoose = require('mongoose');
const { config } = require('./env');
const logger = require('../utils/logger');

/** Mongoose connection options — tuned for production reliability */
const MONGOOSE_OPTIONS = {
  /** Maximum connections in the pool */
  maxPoolSize: 10,
  /** Fail fast if MongoDB is unreachable at startup */
  serverSelectionTimeoutMS: 5000,
  /** Close idle connections after 45s */
  socketTimeoutMS: 45000,
};

/**
 * Opens a Mongoose connection to MongoDB.
 * Called once in server.js before the HTTP server starts.
 *
 * @throws {Error} If the connection cannot be established.
 */
async function connectDatabase() {
  try {
    await mongoose.connect(config.db.uri, MONGOOSE_OPTIONS);
    logger.info('MongoDB connected', {
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
    });
  } catch (error) {
    logger.error('MongoDB connection failed', { message: error.message });
    throw error;
  }
}

/**
 * Closes the Mongoose connection cleanly.
 * Called during graceful shutdown in server.js.
 */
async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('MongoDB disconnection error', { message: error.message });
    throw error;
  }
}

/**
 * Returns a human-readable MongoDB connection state.
 * Used by the readiness endpoint.
 *
 * @returns {'disconnected'|'connected'|'connecting'|'disconnecting'|'unknown'}
 */
function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Returns true if Mongoose is currently connected.
 * Used by the readiness endpoint.
 *
 * @returns {boolean}
 */
function isConnected() {
  return mongoose.connection.readyState === 1;
}

// ------------------------------------------------------------------
// Connection event listeners — log state changes for observability
// ------------------------------------------------------------------

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error', { message: error.message });
});

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  isConnected,
};
