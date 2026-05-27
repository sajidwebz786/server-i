const jwt = require('jsonwebtoken');
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

exports.register = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, referralCode, packageId } = req.body;

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
  const user = await User.findOne({ where: channel === 'email' ? { email: target } : { mobile: target } });
  const otp = await createOtp({ userId: user ? user.id : null, channel, target, purpose });
  const payload = { message: 'OTP generated successfully' };
  if (env.nodeEnv !== 'production') payload.otp = otp.code;
  res.json(payload);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { target, code, purpose = 'login' } = req.body;
  const otp = await verifyOtp({ target, code, purpose });
  if (!otp) throw new ApiError(400, 'Invalid or expired OTP');

  const user = otp.userId ? await User.findByPk(otp.userId) : await User.findOne({ where: { mobile: target } });
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
  await req.user.update(patch);
  res.json({ user: req.user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.user.id);
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  await user.update({ password: req.body.newPassword });
  res.json({ message: 'Password changed successfully' });
});
