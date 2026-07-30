const { BaseError: SequelizeError, ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function errorHandler(err, req, res, _next) {
  void _next;
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Sequelize validation errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join('; ');
  }

  // Sequelize unique constraint
  if (err instanceof UniqueConstraintError) {
    statusCode = 409;
    const fields = err.fields ? Object.keys(err.fields).join(', ') : 'field';
    message = `Duplicate value for ${fields}. This ${fields} is already in use.`;
  }

  // Sequelize foreign key constraint
  if (err instanceof ForeignKeyConstraintError) {
    statusCode = 400;
    message = 'Referenced record not found.';
  }

  // Sequelize generic database error (e.g. type mismatch)
  if (err instanceof SequelizeError && !(err instanceof ValidationError || err instanceof UniqueConstraintError || err instanceof ForeignKeyConstraintError)) {
    statusCode = 400;
    message = err.message || 'Database error';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please log in again.';
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body.';
  }

  // Cookie signature error
  if (err.code === 'COOKIE_SIGNATURE_FAILED') {
    statusCode = 401;
    message = 'Invalid cookie signature.';
  }

  // Unexpected errors — don't leak details in production
  if (!err.isOperational) {
    if (process.env.NODE_ENV === 'production') {
      message = 'Something went wrong. Please try again later.';
    }
  }

  if (process.env.NODE_ENV === 'development') {
    message = `Error: ${err.message}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { AppError, errorHandler };
