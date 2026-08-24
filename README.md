# Campus Marketplace

A student-focused marketplace for buying, selling and exchanging used items within campus communities.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22 LTS |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Templating | EJS + Bootstrap 5 |
| Auth | JWT (HTTP-only cookies) + bcrypt |
| Containerization | Docker + Docker Compose |
| Infrastructure | Terraform (AWS) |
| Configuration | Ansible |
| CI/CD | GitHub Actions + Amazon ECR |

---

## Project Structure

```
campus-marketplace/
├── src/
│   ├── app.js              Express application
│   ├── server.js           Entry point + graceful shutdown
│   ├── config/             Environment + database configuration
│   ├── routes/             API route definitions
│   ├── controllers/        Request handlers
│   ├── services/           Business logic
│   ├── models/             Mongoose schemas
│   ├── middleware/         Auth, validation, error handling, logging
│   ├── validators/         Input validation rules
│   ├── utils/              Logger, errors, API response helpers
│   └── views/              EJS templates (Phase 5)
├── public/                 Static assets (CSS, JS, images)
├── tests/                  Unit and integration tests
├── docker/                 Docker documentation (Phase 7)
├── terraform/              AWS infrastructure (Phase 8)
└── ansible/                EC2 configuration (Phase 9)
```

---

## Getting Started

### Prerequisites

- Node.js 22 LTS
- MongoDB (local installation or Docker)
- npm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd campus-marketplace

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (minimum: MONGODB_URI, JWT_SECRET)
```

### Running the Application

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

The server starts on port 3000 (or the value of the PORT environment variable).

### Verifying the Server

```bash
# Liveness check
curl http://localhost:3000/api/v1/health

# Readiness check (MongoDB connectivity)
curl http://localhost:3000/api/v1/ready
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage
```

Integration tests require MongoDB to be running and accessible via MONGODB_URI.

---

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | development \| test \| production |
| `PORT` | No | HTTP port (default: 3000) |
| `ADMIN_PORT` | No | Dedicated admin dashboard port (default: 3001) |
| `MONGODB_URI` | Yes | Full MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string for JWT signing |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 7d) |
| `COOKIE_SECURE` | No | true in production (requires HTTPS) |
| `COOKIE_SAME_SITE` | No | lax \| strict \| none |
| `CORS_ORIGIN` | No | Allowed origin for CORS |
| `LOG_LEVEL` | No | error \| warn \| info \| debug |

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness probe |
| GET | `/api/v1/ready` | Readiness probe (MongoDB check) |

Additional endpoints are added in later phases:

| Phase | Endpoints Added |
|-------|----------------|
| Phase 3 | `/auth/*`, `/users/me` |
| Phase 4 | `/products/*`, `/categories/*`, `/reports/*` |
| Phase 6 | `/admin/*` |

---

## Development Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | Complete | Architecture blueprint |
| Phase 2 | Complete | Backend foundation (this phase) |
| Phase 3 | Pending | MongoDB models + JWT authentication |
| Phase 4 | Pending | Marketplace / product functionality |
| Phase 5 | Pending | EJS frontend |
| Phase 6 | Pending | Admin panel + production hardening |
| Phase 7 | Pending | Docker + Docker Compose |
| Phase 8 | Pending | AWS + Terraform |
| Phase 9 | Pending | Ansible |
| Phase 10 | Pending | Amazon ECR + GitHub Actions CI/CD |

---

## License

ISC
