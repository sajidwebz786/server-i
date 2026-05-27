const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize, User, Wallet, Package } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { env } = require('../config/env');
const { makeReferralCode } = require('../utils/referralCode');
const { createOtp, verifyOtp } = require('../services/otp.service');

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function publicUser(user) {
  const plain = user.toJSON ? user.toJSON() : user;
  delete plain.password;
  return plain;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '');
}

async function findDuplicateUser({ email, mobile, excludeUserId }) {
  const checks = [];
  if (email) checks.push({ email: normalizeEmail(email) });
  if (mobile) checks.push({ mobile: normalizeMobile(mobile) });
  if (!checks.length) return null;

  const where = { [Op.or]: checks };
  if (excludeUserId) where.id = { [Op.ne]: excludeUserId };
  return User.findOne({ where });
}

function duplicateMessage(existing, email, mobile) {
  if (email && existing.email === normalizeEmail(email)) return 'This email is already registered. Please login instead.';
  if (mobile && existing.mobile === normalizeMobile(mobile)) return 'This mobile number is already registered. Please login instead.';
  return 'This account is already registered. Please login instead.';
}

exports.register = asyncHandler(async (req, res) => {
  const { name, password, referralCode, packageId } = req.body;
  const email = normalizeEmail(req.body.email);
  const mobile = normalizeMobile(req.body.mobile);

  const duplicate = await findDuplicateUser({ email, mobile });
  if (duplicate) throw new ApiError(409, duplicateMessage(duplicate, email, mobile));

  const sponsor = referralCode ? await User.findOne({ where: { referralCode } }) : null;
  if (referralCode && !sponsor) throw new ApiError(400, 'Invalid referral code');

  if (packageId) {
    const selectedPackage = await Package.findByPk(packageId);
    if (!selectedPackage || selectedPackage.status !== 'active') throw new ApiError(400, 'Invalid package selected');
  }

  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({
      name,
      email,
      mobile,
      password,
      referralCode: makeReferralCode(name),
      referredById: sponsor ? sponsor.id : null,
      packageId: packageId || null,
      status: 'pending'
    }, { transaction });

    await Wallet.create({ userId: created.id }, { transaction });
    await createOtp({ userId: created.id, channel: 'mobile', target: mobile, purpose: 'register' }, { transaction });
    return created;
  });

  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const user = await User.scope('withPassword').findOne({
    where: identifier.includes('@') ? { email: identifier } : { mobile: identifier }
  });

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid login credentials');
  }
  if (user.status === 'blocked') throw new ApiError(403, 'Account is blocked');

  await user.update({ lastLoginAt: new Date() });
  res.json({ user: publicUser(user), token: tokenFor(user) });
});

exports.sendOtp = asyncHandler(async (req, res) => {
  const { target, channel = 'mobile', purpose = 'login' } = req.body;
  const normalizedTarget = channel === 'email' ? normalizeEmail(target) : normalizeMobile(target);
  const user = await User.findOne({ where: channel === 'email' ? { email: normalizedTarget } : { mobile: normalizedTarget } });
  const otp = await createOtp({ userId: user ? user.id : null, channel, target: normalizedTarget, purpose });
  const payload = { message: 'OTP generated successfully' };
  if (env.nodeEnv !== 'production') payload.otp = otp.code;
  res.json(payload);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { target, code, channel = 'mobile', purpose = 'login' } = req.body;
  const normalizedTarget = channel === 'email' ? normalizeEmail(target) : normalizeMobile(target);
  const otp = await verifyOtp({ target: normalizedTarget, code, purpose });
  if (!otp) throw new ApiError(400, 'Invalid or expired OTP');

  const user = otp.userId ? await User.findByPk(otp.userId) : await User.findOne({ where: channel === 'email' ? { email: normalizedTarget } : { mobile: normalizedTarget } });
  if (!user) return res.json({ message: 'OTP verified' });

  const patch = {};
  if (otp.channel === 'mobile' || otp.channel === 'whatsapp') patch.isMobileVerified = true;
  if (otp.channel === 'email') patch.isEmailVerified = true;
  await user.update(patch);

  res.json({ message: 'OTP verified', user, token: tokenFor(user) });
});

exports.profile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [
      { model: Package, as: 'package' },
      { association: 'wallet' },
      { association: 'bankDetail' }
    ]
  });
  res.json({ user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'mobile'];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (patch.email !== undefined) patch.email = normalizeEmail(patch.email);
  if (patch.mobile !== undefined) patch.mobile = normalizeMobile(patch.mobile);

  const duplicate = await findDuplicateUser({ email: patch.email, mobile: patch.mobile, excludeUserId: req.user.id });
  if (duplicate) throw new ApiError(409, duplicateMessage(duplicate, patch.email, patch.mobile));

  await req.user.update(patch);
  res.json({ user: req.user });
});

exports.availability = asyncHandler(async (req, res) => {
  const email = req.query.email ? normalizeEmail(req.query.email) : '';
  const mobile = req.query.mobile ? normalizeMobile(req.query.mobile) : '';
  const duplicate = await findDuplicateUser({ email, mobile });
  res.json({
    available: !duplicate,
    emailAvailable: email ? !(duplicate && duplicate.email === email) : true,
    mobileAvailable: mobile ? !(duplicate && duplicate.mobile === mobile) : true,
    message: duplicate ? duplicateMessage(duplicate, email, mobile) : 'You can continue.'
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.user.id);
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  await user.update({ password: req.body.newPassword });
  res.json({ message: 'Password changed successfully' });
});
