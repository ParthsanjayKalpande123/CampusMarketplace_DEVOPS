'use strict';

/**
 * src/middleware/logger.middleware.js
 *
 * HTTP request logging middleware using Morgan piped into Winston.
 *
 * - Production: Apache 'combined' format for maximum log detail.
 * - Development: 'dev' format (concise, colored).
 * - Test: logging is suppressed entirely.
 *
 * Logs are written through the Winston logger, ensuring they appear
 * on stdout in the same structured format as application logs.
 * Docker and CloudWatch collect from stdout automatically.
 */

const morgan = require('morgan');
const logger = require('../utils/logger');
const { config } = require('../config/env');

// Pipe Morgan output through Winston's info level
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Suppress all request logs in test runs
const skip = () => config.isTest;

// Select format based on environment
const format = config.isProduction ? 'combined' : 'dev';

const requestLogger = morgan(format, { stream, skip });

module.exports = requestLogger;
