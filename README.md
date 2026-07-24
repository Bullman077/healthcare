# UHS Healthcare Services

Full-stack web application for **Unmeasurable Heights of Strength Healthcare Services** — a Direct Primary Care practice in Columbia, SC, operated by Nacole Brown, MSN, AGPCNP-BC.

## Features

- **Public Website** — Multi-page marketing site with service listings, membership pricing, testimonials, FAQ, and contact form
- **Online Appointment Booking** — Patients can book appointments with service selection, date/time slots, and auto-generated reference numbers
- **Admin Dashboard** — Full SPA for managing appointments, patients, services, CSV export, progress notes, and follow-up reminders
- **Patient Portal** — SPA where registered patients view appointments, doctor progress notes, reminders, and telehealth video calls
- **Email System** — Automated HTML emails: confirmations, status updates, payment receipts, follow-up reminders, password resets
- **Payment Processing** — Stripe checkout integration (mock mode for development, production-ready)
- **Audit Trail** — Admin action logging for compliance and accountability
- **Double-Booking Prevention** — Time slot conflict detection across all patients
- **Security** — Helmet, CORS, rate limiting, CSRF protection, JWT auth, input validation, mass assignment prevention

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Sequelize ORM) |
| Authentication | JWT (HTTP-only cookies + Bearer tokens) |
| Email | Nodemailer |
| Payments | Stripe (optional) |
| Deployment | PM2, Nginx, Docker, GitHub Actions |

## Project Structure

```
healthcare/
├── index.html, about.html, services.html, ...   # Public pages
├── css/                  # Modular CSS (reset, variables, layout, components, responsive)
├── js/                   # Frontend JS (main, faq, testimonials, contact)
├── assets/               # Images and icons
├── backend/
│   ├── server.js         # Express entry point
│   ├── config/db.js      # Sequelize PostgreSQL connection
│   ├── models/           # Sequelize models (Admin, Patient, Appointment, Service, etc.)
│   ├── controllers/      # Route handlers
│   ├── routes/           # Express route definitions
│   ├── middleware/       # Auth, security, validation, error handling
│   ├── utils/email.js    # Nodemailer email templates
│   ├── public/admin/     # Admin dashboard SPA
│   └── public/patient/   # Patient portal SPA
├── deploy/               # Nginx config, Docker entrypoint
└── scripts/build.js      # HTML minification build script
```

## Getting Started

### Prerequisites

- Node.js v20+
- PostgreSQL 14+ (or Aiven cloud instance)
- npm

### Installation

```bash
cd healthcare/backend
cp .env.example .env
# Edit .env with your database credentials and secrets
npm install
```

### Seed Database

```bash
node seed.js
```

This creates:
- 1 admin user (email/password from `.env`)
- 11 medical services
- 10 sample patients
- 12 sample appointments

### Start Development Server

```bash
node server.js
```

Server runs on `http://localhost:5000`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (use `openssl rand -hex 32`) |
| `COOKIE_SECRET` | Yes | Secret for signed cookies |
| `ADMIN_EMAIL` | No | Default admin email (for seeding) |
| `ADMIN_PASSWORD` | No | Default admin password (for seeding) |
| `EMAIL_HOST` | No | SMTP host (dev: console simulator) |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:5500`) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (blank = mock mode) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments` | Book appointment |
| GET | `/api/appointments/by-email?email=` | Lookup by email |
| GET | `/api/appointments/:ref` | Lookup by reference |
| GET | `/api/services` | Active services |
| POST | `/api/messages` | Submit contact form |
| GET | `/api/testimonials` | Active testimonials |

### Patient Portal
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patient/register` | Create account |
| POST | `/api/patient/login` | Sign in |
| POST | `/api/patient/forgot-password` | Request password reset |
| POST | `/api/patient/reset-password` | Reset password with token |
| GET | `/api/patient/me` | Get profile |
| GET | `/api/patient/appointments` | My appointments |
| GET | `/api/patient/progress` | Progress notes & reminders |

### Admin (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET/PUT | `/api/admin/appointments/:id` | Appointment management |
| GET/PUT | `/api/admin/patients/:id` | Patient management |
| POST | `/api/admin/patients/:id/reminders` | Send follow-up reminder |
| GET/POST/PUT | `/api/admin/services` | Service CRUD |
| PUT | `/api/admin/profile` | Update admin profile |
| GET | `/api/admin/audit-logs` | View audit trail |

## Deployment

### PM2 (Production)

```bash
pm2 start ecosystem.config.js --env production
```

### Docker

```bash
docker build -t uhs-healthcare .
docker run -p 5000:5000 uhs-healthcare
```

### CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:
1. HTML validation
2. CSS/JS minification
3. Frontend deploy to GitHub Pages
4. Backend deploy via rsync + SSH

## License

Proprietary — UHS Healthcare Services
