const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { AppError } = require('./errorHandler');

async function protect(req, res, next) {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.signedCookies && req.signedCookies.token) {
      token = req.signedCookies.token;
    }

    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    if (token.length < 20) {
      return next(new AppError('Invalid token format.', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return next(new AppError('Session expired. Please log in again.', 401));
      }
      if (jwtErr.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid authentication token.', 401));
      }
      return next(new AppError('Authentication failed.', 401));
    }

    if (!decoded.id) {
      return next(new AppError('Invalid token payload.', 401));
    }

    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return next(new AppError('Admin account no longer exists.', 401));
    }

    if (!admin.isActive) {
      return next(new AppError('Admin account has been deactivated.', 401));
    }

    req.admin = admin;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { protect };
