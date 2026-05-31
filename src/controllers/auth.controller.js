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
  if (Object.prototype.hasOwnProperty.call(plain, 'password')) {
    plain.hasPassword = Boolean(plain.password);
  }
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
  if (email && existing.email === normalizeEmail(email)) return 'User email already exists in our database. Please login instead.';
  if (mobile && existing.mobile === normalizeMobile(mobile)) return 'User phone number already exists in our database. Please login instead.';
  return 'User email or phone number already exists in our database. Please login instead.';
}

async function resolveUserTableName() {
  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND lower(table_name) = 'users'
    ORDER BY CASE WHEN table_name = 'Users' THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return tables[0]?.table_name || 'Users';
}

exports.register = asyncHandler(async (req, res) => {
  const { name, referralCode } = req.body;
  const password = req.body.password || null;
  const email = normalizeEmail(req.body.email);
  const mobile = normalizeMobile(req.body.mobile);

  const duplicate = await findDuplicateUser({ email, mobile });
  if (duplicate) throw new ApiError(409, duplicateMessage(duplicate, email, mobile));

  const sponsor = referralCode ? await User.findOne({ where: { referralCode } }) : null;
  if (referralCode && !sponsor) throw new ApiError(400, 'Invalid referral code');

  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({
      name,
      email,
      mobile,
      password,
      referralCode: makeReferralCode(name),
      referredById: sponsor ? sponsor.id : null,
      packageId: null,
      status: 'pending'
    }, { transaction });

    await Wallet.create({ userId: created.id }, { transaction });
    await createOtp({ userId: created.id, channel: 'mobile', target: mobile, purpose: 'register' }, { transaction });
    return created;
  });

  res.status(201).json({ user: publicUser(user), token: tokenFor(user), requiresProfile: true });
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
  res.json({ user: publicUser(user), token: tokenFor(user), requiresProfile: false });
});

exports.sendOtp = asyncHandler(async (req, res) => {
  const { target, channel = 'mobile', purpose = 'login' } = req.body;
  const normalizedTarget = channel === 'email' ? normalizeEmail(target) : normalizeMobile(target);
  const user = await User.findOne({ where: channel === 'email' ? { email: normalizedTarget } : { mobile: normalizedTarget } });
  const otp = await createOtp({ userId: user ? user.id : null, channel, target: normalizedTarget, purpose });
  const payload = { message: 'OTP sent successfully', otp: otp.code };
  res.json(payload);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { target, code, channel = 'mobile', purpose = 'login' } = req.body;
  const normalizedTarget = channel === 'email' ? normalizeEmail(target) : normalizeMobile(target);
  const otp = await verifyOtp({ target: normalizedTarget, code, purpose });
  if (!otp) throw new ApiError(400, 'Invalid or expired OTP');

  const user = otp.userId
    ? await User.scope('withPassword').findByPk(otp.userId)
    : await User.scope('withPassword').findOne({ where: channel === 'email' ? { email: normalizedTarget } : { mobile: normalizedTarget } });
  if (!user) return res.json({ message: 'OTP verified', requiresProfile: true });

  const patch = {};
  if (otp.channel === 'mobile' || otp.channel === 'whatsapp') patch.isMobileVerified = true;
  if (otp.channel === 'email') patch.isEmailVerified = true;
  await user.update(patch);

  res.json({ message: 'OTP verified', user: publicUser(user), token: tokenFor(user), requiresProfile: false });
});

exports.profile = asyncHandler(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.user.id, {
    include: [
      { model: Package, as: 'package' },
      { association: 'wallet' },
      { association: 'bankDetail' }
    ]
  });
  res.json({ user: publicUser(user) });
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
  res.json({ user: publicUser(req.user), requiresProfile: false });
});

exports.updateProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Profile photo is required');
  const avatarUrl = `/uploads/profiles/${req.file.filename}`;
  try {
    const quotedUserTable = sequelize.getQueryInterface().quoteIdentifier(await resolveUserTableName());
    await sequelize.query(
      `UPDATE ${quotedUserTable} SET "avatar_url" = :avatarUrl WHERE "id" = :userId`,
      { replacements: { avatarUrl, userId: req.user.id } }
    );
  } catch (error) {
    if (error?.parent?.code === '42703') {
      throw new ApiError(500, 'Profile photo storage needs the avatar_url database column. Please run the production DB migration.');
    }
    throw error;
  }
  res.json({ user: { ...publicUser(req.user), avatarUrl }, requiresProfile: false });
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
  if (user.password && (!req.body.currentPassword || !(await user.comparePassword(req.body.currentPassword)))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  await user.update({ password: req.body.newPassword });
  res.json({ message: 'Password changed successfully' });
});
