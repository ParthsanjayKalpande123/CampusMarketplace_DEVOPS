# Docker Strategy

Implemented in **Phase 7**.

## Planned Docker Architecture

### Node.js Container
- Base image: `node:22-alpine`
- Working directory: `/app`
- Non-root user: `node`
- Port exposed: `3000`
- Configuration: environment variables only
- HEALTHCHECK: `GET /api/v1/health`

### MongoDB Container
- Image: `mongo:7`
- Port: `27017` (internal network only in production)
- Persistent volume: `mongodb_data`

### Docker Network
- Name: `campus-marketplace-net`
- Driver: bridge
- Both containers communicate over this internal network

### Critical Configuration
The Node.js container connects to MongoDB using the service hostname:
```
MONGODB_URI=mongodb://mongodb:27017/campus_marketplace
```
`localhost` is never used in Docker deployments.

## Files Created in Phase 7
- `Dockerfile` — multi-stage build for the Node.js application
- `docker-compose.yml` — local development multi-container setup
- `.dockerignore` — updated with production exclusions
