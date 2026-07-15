const { sequelize, Withdrawal, BankDetail, User, Wallet, Notification, Payment } = require('../models');
const {
  reserveWithdrawal,
  releaseWithdrawal,
  markWithdrawalPaid
} = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const STATUS_META = {
  pending: { label: 'Initiated', color: 'orange' },
  approved: { label: 'Checking / Verification', color: 'blue' },
  processing: { label: 'Processing for Credit', color: 'red' },
  paid: { label: 'Credited', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' }
};

function timelineEvent(status, updatedBy, remarks) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return {
    status,
    label: meta.label,
    color: meta.color,
    remarks: remarks || null,
    updatedBy: updatedBy ? { id: updatedBy.id, name: updatedBy.name || 'Luminate Ads Team' } : null,
    updatedAt: new Date().toISOString()
  };
}

function normalizeTimeline(withdrawal) {
  const existing = Array.isArray(withdrawal.timeline) ? withdrawal.timeline : [];
  if (existing.length) return existing;
  return [timelineEvent('pending', null, 'Withdrawal request submitted')];
}

function presentWithdrawal(withdrawal) {
  const plain = withdrawal?.toJSON ? withdrawal.toJSON() : withdrawal;
  const meta = STATUS_META[plain.status] || STATUS_META.pending;
  return {
    ...plain,
    statusLabel: meta.label,
    statusColor: meta.color,
    requestDate: plain.createdAt,
    paymentDate: plain.paidAt,
    transactionReferenceNumber: plain.transactionNumber,
    remarks: plain.adminRemarks,
    approvalHistory: normalizeTimeline(plain),
    timeline: normalizeTimeline(plain)
  };
}

exports.request = asyncHandler(async (req, res) => {
  const approvedPayments = await Payment.findAll({
    where: { userId: req.user.id, status: 'approved' },
    attributes: ['approvedAt', 'createdAt', 'subscriptionExpiresAt']
  });
  const hasActivePaidPlan = approvedPayments.some((payment) => {
    const start = payment.approvedAt || payment.createdAt;
    const expiry = payment.subscriptionExpiresAt || (start && new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000));
    return expiry && new Date(expiry) >= new Date();
  });
  const freePayoutEligibleAt = new Date(new Date(req.user.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  if (!hasActivePaidPlan && freePayoutEligibleAt > new Date()) {
    throw new ApiError(400, `Free-plan payout is available after ${freePayoutEligibleAt.toISOString().slice(0, 10)}. Paid-plan payouts may be processed earlier after activation and admin approval.`);
  }
  const bank = await BankDetail.findOne({ where: { userId: req.user.id } });
  if (!bank) throw new ApiError(400, 'Please add bank or UPI details before withdrawal');

  const withdrawal = await sequelize.transaction(async (transaction) => {
    const created = await Withdrawal.create({
      userId: req.user.id,
      amount: req.body.amount,
      bankSnapshot: bank.toJSON(),
      timeline: [timelineEvent('pending', req.user, 'Withdrawal request submitted')]
    }, { transaction });

    await reserveWithdrawal(req.user.id, req.body.amount, created.id, { transaction });
    return created;
  });

  res.status(201).json({ withdrawal: presentWithdrawal(withdrawal) });
});

exports.myWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']]
  });
  res.json({ withdrawals: withdrawals.map(presentWithdrawal) });
});

exports.adminList = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.findAll({
    where: req.query.status ? { status: req.query.status } : {},
    include: [{ model: User, as: 'user', include: [{ model: Wallet, as: 'wallet' }] }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ withdrawals: withdrawals.map(presentWithdrawal) });
});

exports.approve = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new ApiError(400, 'Only pending withdrawals can be approved');

  await withdrawal.update({
    status: 'approved',
    approvedById: req.user.id,
    approvedAt: new Date(),
    adminRemarks: req.body.adminRemarks || null,
    timeline: [...normalizeTimeline(withdrawal), timelineEvent('approved', req.user, req.body.adminRemarks || 'Verification in progress')]
  });
  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal approved',
    body: 'Your withdrawal request has been approved.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal: presentWithdrawal(withdrawal) });
});

exports.reject = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (!['pending', 'approved', 'processing'].includes(withdrawal.status)) {
    throw new ApiError(400, 'This withdrawal cannot be rejected');
  }

  await sequelize.transaction(async (transaction) => {
    await releaseWithdrawal(withdrawal.userId, withdrawal.amount, { transaction });
    await withdrawal.update({
      status: 'rejected',
      adminRemarks: req.body.adminRemarks || null,
      timeline: [...normalizeTimeline(withdrawal), timelineEvent('rejected', req.user, req.body.adminRemarks || 'Withdrawal request could not be processed')]
    }, { transaction });
  });

  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal rejected',
    body: req.body.adminRemarks || 'Your withdrawal request was rejected.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal: presentWithdrawal(withdrawal) });
});

exports.markProcessing = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (withdrawal.status !== 'approved') throw new ApiError(400, 'Only verified withdrawals can be moved to processing');

  await withdrawal.update({
    status: 'processing',
    adminRemarks: req.body.adminRemarks || withdrawal.adminRemarks,
    timeline: [...normalizeTimeline(withdrawal), timelineEvent('processing', req.user, req.body.adminRemarks || 'Processing for credit')]
  });
  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal processing',
    body: 'Your withdrawal is processing for credit.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal: presentWithdrawal(withdrawal) });
});

exports.markPaid = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (withdrawal.status !== 'processing') throw new ApiError(400, 'Only processing withdrawals can be marked paid');

  await sequelize.transaction(async (transaction) => {
    await markWithdrawalPaid(withdrawal.userId, withdrawal.amount, { transaction });
    await withdrawal.update({
      status: 'paid',
      paidAt: new Date(),
      transactionNumber: req.body.transactionNumber || req.body.transactionReferenceNumber || withdrawal.transactionNumber,
      adminRemarks: req.body.adminRemarks || withdrawal.adminRemarks,
      timeline: [
        ...normalizeTimeline(withdrawal),
        timelineEvent('paid', req.user, req.body.adminRemarks || 'Amount credited')
      ]
    }, { transaction });
  });

  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal paid',
    body: 'Your withdrawal has been marked as paid.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal: presentWithdrawal(withdrawal) });
});
