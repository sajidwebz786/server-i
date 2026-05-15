const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { env } = require('../config/env');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication token is required');
  }

  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findByPk(payload.id);

  if (!user || user.status === 'blocked') {
    throw new ApiError(401, 'Invalid or inactive account');
  }

  req.user = user;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { auth, requireRole };
