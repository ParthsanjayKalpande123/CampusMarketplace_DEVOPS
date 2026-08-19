'use strict';

/**
 * src/utils/logger.js
 *
 * Winston-based structured logger.
 *
 * - In production: emits JSON lines to stdout/stderr (CloudWatch-compatible).
 * - In development: emits human-readable colored output.
 * - Logs NEVER written to files inside the container (Docker log driver handles persistence).
 * - Sensitive fields are automatically redacted.
 */

const winston = require('winston');
const { config } = require('../config/env');

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Fields that must never appear in logs
const SENSITIVE_FIELDS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
];

/**
 * Recursively redacts sensitive keys from log metadata.
 *
 * @param {object} obj
 * @returns {object}
 */
function sanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        return [key, '[REDACTED]'];
      }
      if (typeof value === 'object') {
        return [key, sanitize(value)];
      }
      return [key, value];
    })
  );
}

// Custom sanitize format applied before serialization
const sanitizeFormat = winston.format((info) => {
  const sanitized = sanitize(info);
  return Object.assign(info, sanitized);
})();

// Production format: structured JSON for log aggregators
const productionFormat = combine(
  sanitizeFormat,
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  json()
);

// Development format: readable colored text
const developmentFormat = combine(
  colorize({ all: true }),
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    let line = `${ts} [${level}]: ${message}`;
    const cleanMeta = Object.keys(meta).filter((k) => k !== 'service');
    if (cleanMeta.length > 0) {
      const metaObj = {};
      cleanMeta.forEach((k) => {
        metaObj[k] = meta[k];
      });
      line += `  ${JSON.stringify(metaObj)}`;
    }
    if (stack) {
      line += `\n${stack}`;
    }
    return line;
  })
);

const logger = winston.createLogger({
  level: config.log.level,
  defaultMeta: { service: 'campus-marketplace' },
  format: config.isProduction ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console({
      // Errors go to stderr; everything else to stdout.
      // Docker log driver and CloudWatch collect both streams.
      stderrLevels: ['error'],
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Attach sanitize helper so other modules can use it if needed
logger.sanitize = sanitize;

module.exports = logger;
