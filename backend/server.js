const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

dotenv.config({ path: path.join(__dirname, '.env') });

const { sequelize, connectDB } = require('./config/db');
require('./models');
const { Setting } = require('./models');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentRoutes = require('./routes/contentRoutes');
const patientRoutes = require('./routes/patientRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { limiter, csrfProtect } = require('./middleware/security');
const { cspNonce } = require('./middleware/cspNonce');
const { startScheduler } = require('./scheduler');
const { API_BASE } = require('./config/api');
const { runMigrations } = require('./migrate');
const { serveSpa, getAdminHtml } = require('./middleware/serveSpa');

const app = express();
const PORT = process.env.PORT || 5000;

if (parseInt(process.env.TRUST_PROXY, 10) === 1) {
  app.set('trust proxy', 1);
}

/* ============================================================
   Security Middleware Stack
   ============================================================ */

/* 1. CSP Nonce — generate per-request nonce before Helmet */
app.use(cspNonce);

/* 2. Helmet — secure HTTP headers with nonce-based CSP */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Nonce-only on scriptSrc blocks inline XSS. 'unsafe-inline' is a fallback for older browsers.
      scriptSrc: ["'self'", "'unsafe-inline'", (req, res) => `'nonce-${res.locals.nonce}'`],
      // styleSrc must NOT include a nonce — if nonce is present, browsers ignore 'unsafe-inline'
      // per the CSP3 spec, which would block all inline style="" attributes in HTML.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://uhs-backen.onrender.com', 'https://meet.google.com', 'https://js.stripe.com', 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://meet.google.com', 'https://js.stripe.com'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'https:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/* 3. Compression */
app.use(compression({ level: 6, threshold: 1024 }));

/* 4. CORS */
const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
  : ['http://localhost:5000', 'http://localhost:5500', 'http://127.0.0.1:5000', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie'],
}));

/* 5. Cookie parser */
app.use(cookieParser(process.env.COOKIE_SECRET));

/* 6. Rate limiting — global */
app.use(limiter);

/* 7. Body parsing — raw body preserved for Stripe webhooks before json parser */
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

/* 8. HTTP Parameter Pollution protection */
app.use(hpp({ whitelist: ['date', 'time', 'status', 'page', 'limit'] }));

/* 9. CSRF protection — Origin/Referer check on mutating requests */
app.use('/api', csrfProtect);

/* ----- Static Files (Admin Dashboard) ----- */
const isProd = process.env.NODE_ENV === 'production';

// Serve admin HTML with CSP nonce injection (both with and without trailing slash)
const serveAdmin = serveSpa(getAdminHtml, 'admin');
app.get('/admin', serveAdmin);
app.get('/admin/', serveAdmin);

// Serve frontend static files locally when not in production
if (!isProd) {
  app.use(express.static(path.join(__dirname, '..')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
}

// Redirect /patient to the frontend (Firebase Hosting) in production, serve locally when not
app.get('/patient', (req, res) => {
  if (!isProd) {
    res.sendFile(path.join(__dirname, '..', 'patient', 'index.html'));
  } else {
    res.redirect(302, process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0].trim() + '/patient/' : 'https://uhs-healthcare-ea3b4.web.app/patient/');
  }
});
app.get('/patient/', (req, res) => {
  if (!isProd) {
    res.sendFile(path.join(__dirname, '..', 'patient', 'index.html'));
  } else {
    res.redirect(302, process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0].trim() + '/patient/' : 'https://uhs-healthcare-ea3b4.web.app/patient/');
  }
});

// Static assets for admin
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
  index: false,
  maxAge: isProd ? '7d' : '1h',
  etag: true,
  lastModified: true,
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: isProd ? '30d' : '0',
  etag: true,
  lastModified: true,
}));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
  maxAge: isProd ? '30d' : '1h',
  etag: true,
  lastModified: true,
}));


/* ----- API Routes ----- */
app.use(`${API_BASE}/appointments`, appointmentRoutes);
app.use(`${API_BASE}/admin`, adminRoutes);
app.use(`${API_BASE}/patient`, patientRoutes);
app.use(`${API_BASE}/payments`, paymentRoutes);
app.use(`${API_BASE}`, contentRoutes);

/* ----- Health Check ----- */
app.get(`${API_BASE}/health`, (_req, res) => {
  res.json({ success: true, message: 'UHS Healthcare API is running.' });
});

/* ----- 404 ----- */
app.all('*', (req, res) => {
  const url = req.originalUrl;

  // Unknown /api/* routes → return JSON 404 (expected)
  if (url.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: `Route ${url} not found.` });
  }

  // Any other path (e.g. /index.html, /services.html) means the user
  // landed on the backend URL instead of Firebase. Redirect them to the
  // correct page on the Firebase-hosted frontend.
  const raw = process.env.FRONTEND_URL || 'https://uhs-healthcare-ea3b4.web.app';
  const frontendBase = raw.split(',')[0].trim().replace(/\/$/, '');
  return res.redirect(302, frontendBase + url);
});

/* ----- Error Handler ----- */
app.use(errorHandler);

/* ----- Graceful Shutdown ----- */
async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  const { getTransporter } = require('./utils/email');
  const transporter = getTransporter();
  if (transporter) transporter.close();
  await sequelize.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/* ----- Start ----- */
function validateEnv() {
  if (process.env.NODE_ENV === 'test') return;
  // In development mode with SQLite, DATABASE_URL is intentionally empty
  const required = ['JWT_SECRET', 'COOKIE_SECRET'];
  if (process.env.NODE_ENV !== 'development') {
    required.push('DATABASE_URL');
  }
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Consider using a longer secret.');
  }
}

async function seedSiteDefaults() {
  const defaults = {
    /* Clinic info */
    clinic_name: 'UHS Healthcare Services',
    clinic_phone: '(803) 381-7489',
    clinic_email: 'info@uhshealthcare.com',
    clinic_address: '2638 Two Notch Rd. Suite 210 Unit 10\nColumbia, SC 29204',
    clinic_hours: 'Monday – Friday: 8:00 AM – 6:00 PM\nSaturday: 9:00 AM – 2:00 PM\nSunday: Closed (Urgent Telehealth Only)',
    clinic_tagline: 'Heights of Strength',
    footer_brand_desc: 'Unmeasurable Heights of Strength Healthcare Services. Dedicated compassionate care by Nacole Brown, MSN AGPCNP-BC in Columbia, SC.',

    /* Provider / About */
    provider_name: 'Nacole Brown, MSN, AGPCNP-BC',
    provider_credentials: 'Adult-Gerontology Nurse Practitioner',
    provider_photo_url: '/assets/images/nacole-brown-provider.png',
    provider_bio_p1: 'Nacole Brown is the founder of <strong>Unmeasurable Heights of Strength (UHS) Healthcare Services</strong>. Beginning her healthcare career as a Licensed Practical Nurse (LPN), Nacole systematically advanced her education to earn an Associate Degree in Nursing (ADN), Bachelor of Science in Nursing (BSN), and a Master of Science in Nursing (MSN) as an Adult-Gerontology Nurse Practitioner (AGPCNP-BC).',
    provider_bio_p2: 'Her extensive clinical experience spans hospice, home health, long-term care, outpatient occupational health, and chronic disease management.',
    provider_philosophy_title: 'Philosophy of Care',
    provider_philosophy_text: 'Every patient deserves unhurried time, respectful listening, and personalized treatment. UHS Healthcare was created to eliminate the barriers of traditional insurance medicine and deliver care centered around you.',
    value1_title: 'Compassion & Dignity',
    value1_text: 'Treating every patient as a whole person with empathy, respect, and active listening.',
    value2_title: 'Integrity & Transparency',
    value2_text: 'Clear flat pricing, no surprise bills, and honest medical guidance at every visit.',
    value3_title: 'Direct Accessibility',
    value3_text: 'Same-day appointments, 24/7 direct doctor text/phone messaging, and virtual visits.',
    homepage_provider_quote: 'My goal is to help every patient rise above their health challenges through compassionate care, education, and personalized wellness solutions. Together, we can achieve unmeasurable heights of strength.',

    /* Homepage Hero */
    hero_floating_name: 'Nacole Brown, MSN, AGPCNP-BC',
    hero_floating_title: 'Adult-Gerontology Nurse Practitioner',
    hero_stat1_number: '15+',
    hero_stat1_label: 'Years Experience',
    hero_stat2_number: '0 min',
    hero_stat2_label: 'Wait Times',
    hero_stat3_number: '24/7',
    hero_stat3_label: 'Direct NP Access',
    hero_stat4_number: '100%',
    hero_stat4_label: 'Transparent Pricing',

    /* Homepage Why Choose Us */
    why_choose_badge: 'The Occupational Health Difference',
    why_choose_title: 'Healthcare Designed Around You.',
    why_choose_subtitle: 'Experience accessible, unhurried, and transparent wellness care tailored to your life.',
    benefit1_title: 'Unhurried 30–60 Min Visits',
    benefit1_desc: 'Forget 8-minute rushed appointments. Take time to discuss your health with a provider who truly listens.',
    benefit2_title: 'Direct Provider Access',
    benefit2_desc: 'Skip the phone trees and answering services. Reach out via direct text, phone, or virtual telehealth visits.',
    benefit3_title: 'Transparent Pricing & Wholesale Savings',
    benefit3_desc: '$0 copays, predictable direct-pay options, and up to 80–90% wholesale savings on medications.',

    /* Homepage How It Works */
    how_dpc_title: 'How It Works',
    how_dpc_subtitle: 'Simple & Transparent',
    how_dpc_desc: 'Straightforward, predictable, and built around you — get started in three easy steps.',
    dpc_step1_title: 'Select Your Service',
    dpc_step1_desc: 'Choose from our occupational health and wellness services or a one-time visit for your specific needs — no insurance required.',
    dpc_step2_title: 'Direct NP Access',
    dpc_step2_desc: 'Reach NP Brown directly via text, phone, or virtual visit — no phone trees, no answering services, no delays.',
    dpc_step3_title: 'Experience Better Health',
    dpc_step3_desc: 'Enjoy 30–60 minute unhurried visits, $0 copays, wholesale medication pricing, and a provider who truly knows your history.',

    /* Homepage Core Services */
    homepage_services_title: 'Services Tailored to Your Life',
    homepage_services_subtitle: 'Comprehensive Care',

    /* Homepage Wellness */
    homepage_wellness_title: 'Targeted Care for Your Health Goals',
    homepage_wellness_subtitle: 'Specialized Wellness Programs',
    wellness1_title: 'Medically Supervised Weight Loss',
    wellness1_desc: 'Custom plans combining nutrition, exercise, and GLP-1 therapy to reach and maintain a healthy BMI.',
    wellness2_title: 'Iontopherisis Patch Therapy',
    wellness2_desc: 'Non-invasive anti-inflammatory medication delivery to reduce pain, swelling, and improve mobility.',
    wellness3_title: 'Chronic Pain Management',
    wellness3_desc: 'Individualized care plans combining advanced therapies and lifestyle strategies for lasting relief.',

    /* Homepage Comparison */
    comparison_title: 'Occupational Health vs. Traditional Healthcare',
    comparison_subtitle: 'Why Choose UHS Healthcare',

    /* Homepage FAQ */
    faq_title: 'Frequently Asked Questions',
    faq_intro: 'Find clear answers about our occupational health, telehealth, and clinic services.',

    /* Homepage CTA */
    cta_title: 'Experience Healthcare Built Around You',
    cta_text: 'Join UHS Healthcare today and enjoy unhurried visits, direct NP access, and transparent pricing.',

    /* Homepage Testimonials */
    testimonials_section_title: 'What Our Patients Say',
    testimonials_section_subtitle: 'Patient Experiences',

    /* Contact Page */
    contact_heading: 'Reach UHS Healthcare',
    contact_intro: 'We are here to answer your questions about membership, services, and appointment scheduling.',
    contact_badge: 'Get In Touch',

    /* Telehealth Page */
    telehealth_hero_badge: '100% HIPAA Compliant Virtual Visits',
    telehealth_hero_title: 'Compassionate Virtual Care\nFrom the Comfort of Home.',
    telehealth_hero_text: 'Connect directly with Nacole Brown, MSN AGPCNP-BC through secure video or messaging. Perfect for urgent minor illnesses, medication refills, and ongoing wellness follow-ups.',
    telehealth_steps_title: 'How Virtual Telehealth Visits Work',
    telehealth_steps_subtitle: 'Simple 3-Step Process',
    telehealth_steps_desc: 'Getting high-quality care has never been easier or more convenient.',
    telehealth_step1_title: 'Book Your Appointment',
    telehealth_step1_desc: 'Select your preferred date and time slot online or over the phone.',
    telehealth_step2_title: 'Receive Secure Link',
    telehealth_step2_desc: 'Receive a private, HIPAA-compliant video link via SMS or email right before your appointment.',
    telehealth_step3_title: 'Consult & Get Care',
    telehealth_step3_desc: 'Meet face-to-face with Nacole Brown, MSN AGPCNP-BC. Prescriptions are sent immediately to your local pharmacy.',
    telehealth_conditions_title: 'What We Can Treat via Telehealth',
    telehealth_conditions_subtitle: 'Virtual Care Capabilities',
    telehealth_conditions_desc: 'Many common medical issues can be safely evaluated and managed virtually.',

    /* Services Page */
    services_hero_title: 'Our Healthcare Services.',
    services_hero_text: 'From DOT physicals and occupational health screenings to medical weight management, patch therapy, and virtual care.',
    services_section_title: 'Specialized Care Designed for You',
    services_section_subtitle: 'Medical Care Options',
    services_section_desc: 'Explore our full suite of occupational and specialty medical services.',

    /* Privacy & Terms */
    privacy_policy: '',
    terms_of_service: '',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await Setting.findOne({ where: { key } });
    if (!existing && value) {
      await Setting.create({ key, value });
    }
  }
}

async function start() {
  try {
    validateEnv();
    await connectDB();
    await runMigrations();   // Umzug-managed schema migrations (replaces sequelize.sync)
    await seedSiteDefaults();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
      startScheduler();
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
