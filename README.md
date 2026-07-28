# UHS Healthcare Services — Website

Production: [uhs-healthcare-ea3b4.web.app](https://uhs-healthcare-ea3b4.web.app) | Custom domain: [uhshealthcare.com](https://uhshealthcare.com)

Occupational Health & Wellness practice website for Unmeasurable Heights of Strength Healthcare Services, Columbia, SC. Patient-facing public site with appointment booking, a HIPAA-conscious patient portal, telehealth integration, and an admin dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (public) | Vanilla HTML/CSS/JS, glass-morphism UI, plum/indigo/blue palette |
| Hosting (frontend) | Firebase Hosting |
| Backend API | Express.js, Sequelize ORM, PostgreSQL (Aiven cloud) |
| Hosting (backend) | Render |
| Auth | JWT access tokens (15 min), httpOnly signed cookies, refresh tokens (8 hours) |
| Admin dashboard | Single-page app (`backend/public/admin/index.html`) served via Render |
| Patient portal | SPA (`patient/index.html`) hosted on Firebase, backend API on Render |
| Email | Nodemailer |
| Payments | Stripe (test mode) |
| Testing | Jest + Supertest (27 tests) |

---

## Live URLs

| Service | URL |
|---|---|
| Public site | `https://uhs-healthcare-ea3b4.web.app` |
| Custom domain | `https://uhshealthcare.com` |
| Backend API | `https://uhs-backen.onrender.com` |
| Admin dashboard | `https://uhs-backen.onrender.com/admin/` |
| Patient portal | `https://uhs-healthcare-ea3b4.web.app/patient/` |

---

## Features

### Public Pages
- Home, About, Services, Telehealth, Appointment, Contact, Privacy, Terms
- Booking modal with simplified form for logged-in patients
- Dynamic content via `site-content.js` (admin settings propagate to all pages)
- Testimonials carousel, FAQ accordion with search/filter
- SEO: canonical links, Open Graph, Twitter cards, JSON-LD structured data
- `robots.txt` and `sitemap.xml` for crawlability

### Patient Portal
- Registration and login with JWT + httpOnly cookies
- View appointments, progress notes, reminders
- Book appointments (pre-filled when logged in on public pages)
- Forgot password with email reset flow

### Admin Dashboard
- SPA with login, session management, profile photo upload
- Manage services, appointments, patients, testimonials, site content/settings
- Profile page: name, email, password changes
- Settings page: clinic name, contact info, provider details, telehealth copy

### Security
- Helmet.js (CSP with nonce, HSTS, X-Frame-Options)
- CORS (Firebase origin allowed, credentials enabled)
- Rate limiting (API, auth, admin write routes)
- SQL injection protection (Sequelize parameterized queries)
- XSS protection (output escaping, CSP)
- HPP (HTTP Parameter Pollution)
- Brute-force lockout (3 attempts / 15 min for patient, admin)
- Token revocation via `tokenVersion` field
- `sameSite: 'lax'` on all cookies

---

## Project Structure

```
healthcare/
├── index.html                  # Homepage
├── about.html                  # About NP Brown
├── services.html               # Services page
├── telehealth.html             # Telehealth page
├── appointment.html            # Appointment booking
├── contact.html                # Contact page
├── privacy.html                # Privacy policy
├── terms.html                  # Terms of service
├── robots.txt                  # SEO crawl directives
├── sitemap.xml                 # XML sitemap
├── firebase.json               # Firebase hosting config
├── .firebaserc                 # Firebase project config
│
├── css/
│   ├── reset.css
│   ├── variables.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
│
├── js/
│   ├── main.js                 # Nav, booking modal, patient auth, testimonials
│   └── site-content.js         # Dynamic content loader (admin settings → public pages)
│
├── assets/images/              # Static images (hero, icons, og-image)
│
├── patient/
│   ├── index.html              # Patient portal SPA
│   └── patient.css             # Portal styles
│
└── backend/
    ├── server.js               # Express app, middleware stack, static files
    ├── package.json
    ├── config/db.js            # Sequelize + Aiven PostgreSQL connection
    ├── models/                 # Admin, Patient, Appointment, Service, Testimonial, Setting, Message
    ├── controllers/            # Route handlers
    ├── routes/                 # Express routers
    ├── middleware/              # Auth (admin/patient), rate limiting, validation, error handler
    ├── utils/email.js          # Nodemailer transport
    ├── migrations/             # Umzug migrations
    ├── seeds/                  # Seed data
    ├── tests/api.test.js       # Jest + Supertest (27 tests)
    └── public/admin/
        ├── index.html          # Admin dashboard SPA
        └── admin.css           # Admin styles
```

---

## Firebase Hosting Config

`firebase.json` rewrites route API, admin, uploads, patient portal, and all other paths:

```json
"/api/**"     → "https://uhs-backen.onrender.com/api/:splat"
"/admin/**"   → "https://uhs-backen.onrender.com/admin/:splat"
"/uploads/**" → "https://uhs-backen.onrender.com/uploads/:splat"
"/patient/**" → "/patient/index.html"
"**"          → "/index.html"
```

---

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Aiven cloud)
- Firebase CLI (`npm install -g firebase-tools`)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in values
npx umzug up           # run migrations
npm start              # starts on port defined in PORT env
```

### Frontend (local development)

```bash
# serve from project root
npx serve . -p 5500
# or use Firebase emulator
firebase emulators:start
```

### Environment Variables (Backend)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=<random-64-char-hex>
JWT_EXPIRES_IN=15m
FRONTEND_URL=https://uhs-healthcare-ea3b4.web.app,http://localhost:5500,http://localhost:5000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@uhshealthcare.com
```

---

## Deployment

### Backend (Render)
- Auto-deploys on push to `master`
- Runs migrations via `scripts/deploy.sh` or Umzug on startup

### Frontend (Firebase)

```bash
firebase deploy --only hosting
```

Deploys all public HTML, CSS, JS, images, `robots.txt`, and `sitemap.xml`.

---

## Testing

```bash
cd backend
npm test
```

27 tests covering: authentication, patient CRUD, appointments, services, admin routes, content/settings, and error handling.

---

## Key Commits

| Commit | Description |
|---|---|
| `c814ea0` | Fix: return JWT token in patient login/refresh responses (restores portal session on public pages) |
| `b601f5c` | SEO: robots.txt, sitemap.xml, canonical links, OG tags, Twitter cards, JSON-LD across all pages |
| `b307ed2` | Admin: enable email change with duplicate validation |
| `90d6ff3` | Fix: sync admin profile photo to about page provider photo |
| `27d890c` | Fix: connect admin settings to public pages via `data-content` attributes |
| `d50a543` | Admin session security: page-refresh-only restore, 8-hour refresh tokens |
| `0350d4e` | Security hardening: Helmet/CSP, rate limiting, HPP, brute-force lockout |
| `fef6cba` | Fix: Cloudflare redirect loop on admin dashboard |
