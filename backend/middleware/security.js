const rateLimit = require('express-rate-limit');
const { AppError } = require('./errorHandler');

/* ----- Global rate limit (all routes) ----- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/* ----- Auth rate limit (login attempts) ----- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 50 : 3, // 3 in prod, 50 in tests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes before trying again.' },
});

/* ----- API rate limit (appointment booking) ----- */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Slow down.' },
});

/* ----- CSRF Protection — Origin / Referer check ----- */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5500')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''));

function csrfProtect(req, res, next) {
  // Only check mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Allow requests with no origin/referer (e.g. server-to-server, curl)
  if (!origin && !referer) {
    // In production, reject requests without origin/referer for mutating methods
    if (process.env.NODE_ENV === 'production') {
      return next(new AppError('CSRF: Request origin is required.', 403));
    }
    // In development, allow (for Postman, curl testing)
    return next();
  }

  const source = origin || referer;

  // Always allow same-host requests (admin panel served from same server)
  try {
    const srcHost = new URL(source).hostname;
    const reqHost = req.hostname;
    if (srcHost === reqHost || srcHost === 'localhost' || srcHost === '127.0.0.1') {
      return next();
    }
  } catch (e) { /* malformed origin, fall through to check */ }

  const isAllowed = allowedOrigins.some((allowed) => source.startsWith(allowed));

  if (!isAllowed) {
    console.warn(`CSRF blocked: ${req.method} ${req.originalUrl} from origin ${source}`);
    return next(new AppError('CSRF: Request origin not allowed.', 403));
  }

  next();
}

/* ----- Admin write rate limit (mutating admin endpoints) ----- */
const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin operations. Slow down.' },
});

/* ----- Password reset / forgot-password rate limit (very strict) ----- */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 50 : 3, // 3 per hour in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again in 1 hour.' },
});

/* ----- Patient registration rate limit ----- */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 50 : 5, // 5 per hour in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

module.exports = { limiter, authLimiter, apiLimiter, adminWriteLimiter, passwordResetLimiter, registerLimiter, csrfProtect };
