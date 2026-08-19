'use strict';

/**
 * src/server.js
 *
 * Application entry point.
 *
 * Responsibilities:
 *  1. Validate environment variables (fails fast on misconfiguration).
 *  2. Connect to MongoDB before accepting HTTP traffic.
 *  3. Start the HTTP server on the configured port.
 *  4. Handle graceful shutdown on SIGTERM / SIGINT.
 *  5. Handle unhandled promise rejections and uncaught exceptions.
 *
 * Graceful shutdown is critical for Docker:
 *   - 'docker stop' sends SIGTERM → we close the server and DB cleanly.
 *   - Prevents data corruption and in-flight request failures.
 */

// Validate environment BEFORE importing anything else.
// This ensures config.js throws early if required variables are absent.
const { validateEnv } = require('./config/env');

try {
  validateEnv();
} catch (error) {
  // Logger may not be available yet — use console directly for startup errors.
  // eslint-disable-next-line no-console
  console.error(`[STARTUP ERROR] ${error.message}`);
  process.exit(1);
}

const { config } = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const app = require('./app');

/** @type {import('http').Server} */
let server;

// ------------------------------------------------------------------
// Server startup
// ------------------------------------------------------------------

async function startServer() {
  try {
    // Step 1: Connect to MongoDB. HTTP server does not start until DB is ready.
    await connectDatabase();

    // Step 2: Seed default categories if the collection is empty.
    // Non-fatal: a seeding failure logs a warning but does not abort startup.
    try {
      const { seedDefaultCategories } = require('./services/category.service');
      await seedDefaultCategories();
    } catch (seedErr) {
      logger.warn('Category seeding skipped due to error', { reason: seedErr.message });
    }

    // Step 3: Start HTTP server.
    server = app.listen(config.port, () => {
      logger.info(`${config.app.name} is running`, {
        port: config.port,
        env: config.env,
        pid: process.pid,
        nodeVersion: process.version,
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Is another instance running?`);
        process.exit(1);
      }
      throw err;
    });
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

// ------------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------------

/**
 * Closes the HTTP server and MongoDB connection cleanly.
 * Called on SIGTERM, SIGINT, and unhandled rejections.
 *
 * @param {string} signal - Signal that triggered the shutdown.
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received — initiating graceful shutdown`);

  // Force-kill if shutdown takes too long (Docker default stop timeout is 10s)
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10 seconds — forcing exit');
    process.exit(1);
  }, 10000);

  try {
    // Stop accepting new connections; allow in-flight requests to complete.
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    // Close MongoDB connection.
    await disconnectDatabase();

    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error(`Error during graceful shutdown: ${err.message}`);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ------------------------------------------------------------------
// Unhandled promise rejections — log and initiate graceful shutdown
// ------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED PROMISE REJECTION', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ------------------------------------------------------------------
// Uncaught exceptions — log and exit immediately (state is undefined)
// ------------------------------------------------------------------
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION — process will exit', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
startServer();
