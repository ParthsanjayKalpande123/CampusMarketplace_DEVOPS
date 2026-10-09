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

## Marketplace features

Signed-in students can save listings and searches, browse recently viewed and similar products, manage interests and notifications, compare listings, propose price or exchange offers, reserve items, schedule campus pickup, confirm a handover with an order QR code, review completed transactions, block users, and report listings or sellers. Listings support free, lost, and found types plus category-specific details.

Orders created by an accepted offer or reservation are **not paid online**: payment integration is intentionally pending selection and setup of a payment provider. Their payment status is shown as `not-integrated`.

AI listing generation, price suggestions, the marketplace assistant, quality checks, and scam-risk checks use Google's Gemini Interactions API, defaulting to `gemini-3.8-flash`. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the application environment. AI results are advisory. Potential fraud flags are sent to the admin dashboard for human review. Without the API key, the AI endpoints return a clear configuration error.

College details can be saved, but verification badges remain unavailable until an email delivery/verification service is configured. The verification request endpoint does not mark accounts verified.

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

### Preview with local demo data

With MongoDB running, use `npm run seed:demo` to create a clearly labelled set of sample accounts, listings, offers, orders, reviews, notifications, saved searches, and other marketplace activity. The script prints a randomly generated password for the demo student and seller accounts. It is disabled when `NODE_ENV=production`; running it again refreshes activity for those reserved demo accounts.

For Docker Compose, add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) to the root `.env` file and rebuild the app container with `docker compose up -d --build app`. Then seed the local database with `docker compose exec app npm run seed:demo`.

For a larger local load/UI test dataset, run `npm run seed:test-data -- --execute --confirm-database=campus_marketplace`. This creates 25 clearly labeled demo accounts and 150 clearly labeled listings. The seeder only permits the local `campus_marketplace` database, refuses `NODE_ENV=production`, and never updates or deletes existing records. The first successful run prints a shared password for newly created accounts; store it securely because it is not saved in the repository. Re-running skips records that already exist.

With Docker Compose, run `docker compose exec app npm run seed:test-data -- --execute --confirm-database=campus_marketplace`.

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
| `GEMINI_API_KEY` | No | Server-side key for Gemini-powered marketplace tools |
| `GEMINI_MODEL` | No | Gemini model (default: `gemini-3.8-flash`) |

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness probe |
| GET | `/api/v1/ready` | Readiness probe (MongoDB check) |

| Method | Path | Description |
|--------|------|-------------|
| `*` | `/api/v1/auth/*` | Registration, login, and logout |
| `*` | `/api/v1/users/*` | User account and profile operations |
| `*` | `/api/v1/products/*` | Listing search, management, and status |
| `*` | `/api/v1/categories/*` | Marketplace categories |
| `*` | `/api/v1/reports/*` | Listing reports |
| `*` | `/api/v1/messages/*` | Buyer-seller messaging |
| `*` | `/api/v1/features/*` | Wishlist, offers, orders, reviews, notifications, saved searches, and AI |
| `*` | `/api/v1/admin/*` | Administration and report review |

---

## Implementation status

- Marketplace, campus activity, profile, moderation, and AI-assisted listing features are implemented.
- AI features require a configured Gemini API key and a responding Gemini service; AI results are advisory.
- Online payment processing is not configured. Orders show `not-integrated` payment status until a provider is selected and integrated.
- College verification requests remain pending until an email delivery and verification service is configured.
- Docker, Terraform, Ansible, and the existing GitHub Actions CI/CD workflows remain part of the deployment setup.

---

## License

ISC