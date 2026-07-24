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
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentRoutes = require('./routes/contentRoutes');
const patientRoutes = require('./routes/patientRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { limiter, csrfProtect } = require('./middleware/security');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

if (parseInt(process.env.TRUST_PROXY, 10) === 1) {
  app.set('trust proxy', 1);
}

/* ============================================================
   Security Middleware Stack
   ============================================================ */

/* 1. Helmet — secure HTTP headers */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/* 2. Compression */
app.use(compression({ level: 6, threshold: 1024 }));

/* 3. CORS */
const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
  : 'http://localhost:5500';

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie'],
}));

/* 4. Cookie parser */
app.use(cookieParser(process.env.COOKIE_SECRET));

/* 5. Rate limiting — global */
app.use(limiter);

/* 6. Body parsing — raw body preserved for Stripe webhooks before json parser */
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

/* 7. HTTP Parameter Pollution protection */
app.use(hpp({ whitelist: ['date', 'time', 'status', 'page', 'limit'] }));

/* 8. CSRF protection — Origin/Referer check on mutating requests */
app.use('/api', csrfProtect);

/* ----- Static Files (Admin Dashboard, Patient Portal & Frontend) ----- */
const isProd = process.env.NODE_ENV === 'production';
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
  maxAge: isProd ? '7d' : '1h',
  etag: true,
  lastModified: true,
}));
app.use('/patient', express.static(path.join(__dirname, 'public', 'patient'), {
  maxAge: isProd ? '7d' : '1h',
  etag: true,
  lastModified: true,
}));
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: isProd ? '1d' : '0',
}));


/* ----- API Routes ----- */
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', contentRoutes);

/* ----- Health Check ----- */
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'UHS Healthcare API is running.' });
});

/* ----- 404 ----- */
app.all('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
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
  const required = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Consider using a longer secret.');
  }
}

async function start() {
  try {
    validateEnv();
    await connectDB();
    await sequelize.sync();
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
