const { sequelize, Payment, Package, User, Notification } = require('../models');
const { creditReferralIncome, buildReferralChain } = require('../services/referral.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { withPaymentProof } = require('../utils/files');

exports.create = asyncHandler(async (req, res) => {
  const pkg = await Package.findByPk(req.body.packageId);
  if (!pkg || pkg.status !== 'active') throw new ApiError(400, 'Invalid package selected');
  const paymentMode = req.body.paymentMode || 'manual';
  const utrNumber = String(req.body.utrNumber || '').trim();
  const requiresProof = paymentMode !== 'cash';
  if (requiresProof && !utrNumber) throw new ApiError(400, 'UTR / transaction number is required');
  if (requiresProof && !req.file) throw new ApiError(400, 'Payment proof is required');

  const payment = await Payment.create({
    userId: req.user.id,
    packageId: pkg.id,
    amount: pkg.finalAmount,
    paymentMode,
    utrNumber: utrNumber || null,
    screenshot: req.file ? `/uploads/payments/${req.file.filename}` : null
  });

  res.status(201).json({ payment: withPaymentProof(payment) });
});

exports.myPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.findAll({
    where: { userId: req.user.id },
    include: [{ model: Package, as: 'package' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ payments: payments.map(withPaymentProof) });
});

exports.pending = asyncHandler(async (req, res) => {
  const payments = await Payment.findAll({
    where: req.query.status ? { status: req.query.status } : {},
    include: [{ model: User, as: 'user' }, { model: Package, as: 'package' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ payments: payments.map(withPaymentProof) });
});

exports.approve = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, {
    include: [{ model: User, as: 'user' }, { model: Package, as: 'package' }]
  });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status === 'approved') throw new ApiError(400, 'Payment is already approved');

  await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const currentExpiry = payment.user.subscriptionExpiresAt ? new Date(payment.user.subscriptionExpiresAt) : now;
    const renewalStart = currentExpiry > now ? currentExpiry : now;
    const nextExpiry = new Date(renewalStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    await payment.update({
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminRemarks: req.body.adminRemarks || null
    }, { transaction });

    await payment.user.update({
      status: 'active',
      packageId: payment.packageId,
      subscriptionExpiresAt: nextExpiry
    }, { transaction });

    await buildReferralChain(payment.user, payment.packageId, { transaction });
    await creditReferralIncome({ user: payment.user, packageRecord: payment.package, payment }, { transaction });
    await Notification.create({
      userId: payment.userId,
      title: 'Payment approved',
      body: `Your package payment has been approved. Your subscription is valid until ${nextExpiry.toISOString().split('T')[0]}.`, 
      type: 'payment',
      data: { paymentId: payment.id, subscriptionExpiresAt: nextExpiry.toISOString() }
    }, { transaction });
  });

  res.json({ payment: withPaymentProof(await Payment.findByPk(payment.id)) });
});

exports.reject = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  await payment.update({ status: 'rejected', adminRemarks: req.body.adminRemarks || null });
  await Notification.create({
    userId: payment.userId,
    title: 'Payment rejected',
    body: req.body.adminRemarks || 'Your payment proof was rejected.',
    type: 'payment',
    data: { paymentId: payment.id }
  });
  res.json({ payment: withPaymentProof(payment) });
});
