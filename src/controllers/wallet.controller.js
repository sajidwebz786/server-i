const { Wallet, Transaction, BankDetail } = require('../models');
const { ensureWallet } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.summary = asyncHandler(async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  const transactions = await Transaction.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 20
  });
  res.json({ wallet, transactions });
});

exports.transactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']]
  });
  res.json({ transactions });
});

exports.upsertBank = asyncHandler(async (req, res) => {
  const [bankDetail, created] = await BankDetail.findOrCreate({
    where: { userId: req.user.id },
    defaults: { userId: req.user.id, ...req.body }
  });
  if (!created) {
    throw new ApiError(403, 'Bank details are locked after first submission. Please contact admin for changes.');
  }
  await bankDetail.update(req.body);
  res.json({ bankDetail });
});

exports.bank = asyncHandler(async (req, res) => {
  const bankDetail = await BankDetail.findOne({ where: { userId: req.user.id } });
  res.json({ bankDetail });
});
