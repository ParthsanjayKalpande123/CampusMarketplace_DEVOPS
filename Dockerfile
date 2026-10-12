# =============================================================================
# Dockerfile — Campus Marketplace (Node.js)
#
# Multi-stage build:
#   Stage 1 (deps)       — install production dependencies only
#   Stage 2 (production) — minimal runtime image with non-root user
#
# Target:  node:22-alpine   (~50 MB base, LTS release)
# User:    nodejs (non-root, UID 1001) — required for container security
# Port:    3000
#
# Usage:
#   Build:   docker build -t campus-marketplace .
#   Run:     docker run -p 3000:3000 --env-file .env campus-marketplace
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — Install production dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# bcrypt falls back to a native build when a prebuilt binary is unavailable.
RUN apk add --no-cache python3 make g++

# Copy only dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install production dependencies only; skip devDependencies
RUN npm_config_nodedir=/usr/local npm ci --omit=dev && npm cache clean --force


# ---------------------------------------------------------------------------
# Stage 2 — Production runtime image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production

# Labels for OCI image spec
LABEL org.opencontainers.image.title="Campus Marketplace" \
      org.opencontainers.image.description="Student-focused campus buy/sell/exchange platform" \
      org.opencontainers.image.source="https://github.com/your-org/campus-marketplace"

# Set environment defaults (overridden at runtime via docker-compose / ENV vars)
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nodejs -G nodejs

# Copy production node_modules from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source with correct ownership
# .dockerignore excludes: node_modules, .git, tests, .env*, coverage, etc.
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3000

# Health check — hits the /api/v1/health endpoint
# start-period gives MongoDB time to become ready on first boot
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=40s \
  --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

# Run the server (not npm start — avoids extra Node process)
CMD ["node", "src/server.js"]
