const crypto = require('crypto');

/**
 * Middleware that generates a per-request CSP nonce and attaches it to res.locals.
 * Use res.locals.nonce in Helmet CSP directives and in HTML templates.
 */
function cspNonce(req, res, next) {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
}

module.exports = { cspNonce };
