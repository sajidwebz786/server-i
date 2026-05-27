const ApiError = require('../utils/apiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const isUniqueError = err.name === 'SequelizeUniqueConstraintError';
  const statusCode = isUniqueError ? 409 : err.statusCode || 500;
  const payload = {
    message: isUniqueError ? 'User email or phone number already exists in our database. Please login instead.' : err.message || 'Internal server error'
  };

  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== 'production') payload.stack = err.stack;

  res.status(statusCode).json(payload);
}

module.exports = { notFound, errorHandler };
