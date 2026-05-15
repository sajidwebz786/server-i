const { sequelize, Withdrawal, BankDetail, User, Wallet, Notification } = require('../models');
const {
  reserveWithdrawal,
  releaseWithdrawal,
  markWithdrawalPaid
} = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.request = asyncHandler(async (req, res) => {
  const bank = await BankDetail.findOne({ where: { userId: req.user.id } });
  if (!bank) throw new ApiError(400, 'Please add bank or UPI details before withdrawal');

  const withdrawal = await sequelize.transaction(async (transaction) => {
    const created = await Withdrawal.create({
      userId: req.user.id,
      amount: req.body.amount,
      bankSnapshot: bank.toJSON()
    }, { transaction });

    await reserveWithdrawal(req.user.id, req.body.amount, created.id, { transaction });
    return created;
  });

  res.status(201).json({ withdrawal });
});

exports.myWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']]
  });
  res.json({ withdrawals });
});

exports.adminList = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.findAll({
    where: req.query.status ? { status: req.query.status } : {},
    include: [{ model: User, as: 'user', include: [{ model: Wallet, as: 'wallet' }] }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ withdrawals });
});

exports.approve = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new ApiError(400, 'Only pending withdrawals can be approved');

  await withdrawal.update({
    status: 'approved',
    approvedById: req.user.id,
    approvedAt: new Date(),
    adminRemarks: req.body.adminRemarks || null
  });
  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal approved',
    body: 'Your withdrawal request has been approved.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal });
});

exports.reject = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (!['pending', 'approved'].includes(withdrawal.status)) {
    throw new ApiError(400, 'This withdrawal cannot be rejected');
  }

  await sequelize.transaction(async (transaction) => {
    await releaseWithdrawal(withdrawal.userId, withdrawal.amount, { transaction });
    await withdrawal.update({
      status: 'rejected',
      adminRemarks: req.body.adminRemarks || null
    }, { transaction });
  });

  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal rejected',
    body: req.body.adminRemarks || 'Your withdrawal request was rejected.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal });
});

exports.markPaid = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findByPk(req.params.id);
  if (!withdrawal) throw new ApiError(404, 'Withdrawal not found');
  if (withdrawal.status !== 'approved') throw new ApiError(400, 'Only approved withdrawals can be marked paid');

  await sequelize.transaction(async (transaction) => {
    await markWithdrawalPaid(withdrawal.userId, withdrawal.amount, { transaction });
    await withdrawal.update({ status: 'paid', paidAt: new Date() }, { transaction });
  });

  await Notification.create({
    userId: withdrawal.userId,
    title: 'Withdrawal paid',
    body: 'Your withdrawal has been marked as paid.',
    type: 'withdrawal',
    data: { withdrawalId: withdrawal.id }
  });
  res.json({ withdrawal });
});
