'use strict';

/**
 * src/utils/metrics.js
 *
 * Prometheus metrics setup using prom-client.
 * Exposes default Node.js metrics (CPU, memory, event loop, GC, etc.)
 * plus custom HTTP request duration histogram.
 *
 * Usage:
 *   const { register, httpRequestDuration } = require('./utils/metrics');
 *   // In app.js: mount GET /metrics route
 */

const client = require('prom-client');

// Collect all default Node.js metrics (memory, CPU, GC, event loop lag…)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ─── Custom Metrics ────────────────────────────────────────────────────────

/**
 * HTTP request duration in seconds — labelled by method, route, status code.
 */
const httpRequestDuration = new client.Histogram({
  name:    'http_request_duration_seconds',
  help:    'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

/**
 * Total HTTP requests counter — labelled by method, route, status code.
 */
const httpRequestTotal = new client.Counter({
  name:    'http_requests_total',
  help:    'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Active connections gauge.
 */
const activeConnections = new client.Gauge({
  name:    'active_connections',
  help:    'Number of active HTTP connections',
  registers: [register],
});

module.exports = { register, httpRequestDuration, httpRequestTotal, activeConnections };
