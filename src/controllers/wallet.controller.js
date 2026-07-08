const { Op } = require('sequelize');
const { Wallet, Transaction, BankDetail, Payment, Package, Income, Withdrawal } = require('../models');
const { ensureWallet } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { withPaymentProof } = require('../utils/files');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function historyRow(payload) {
  return {
    transactionId: payload.id,
    date: payload.date ? new Date(payload.date).toISOString().slice(0, 10) : null,
    time: payload.date ? new Date(payload.date).toISOString().slice(11, 19) : null,
    amount: money(payload.amount),
    status: payload.status,
    transactionType: payload.transactionType,
    type: payload.type,
    remarks: payload.remarks || null,
    balanceAfter: payload.balanceAfter === undefined ? null : money(payload.balanceAfter),
    finalCreditedAmount: payload.finalCreditedAmount === undefined ? null : money(payload.finalCreditedAmount),
    source: payload.source || null
  };
}

async function buildHistory(userId, query = {}) {
  const whereDate = {};
  if (query.from || query.to) {
    whereDate[Op.between] = [
      query.from ? new Date(query.from) : new Date('1970-01-01'),
      query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date()
    ];
  }

  const createdAtFilter = Object.keys(whereDate).length ? { createdAt: whereDate } : {};
  const [transactions, payments, incomes, withdrawals] = await Promise.all([
    Transaction.findAll({ where: { userId, ...createdAtFilter }, order: [['createdAt', 'DESC']] }),
    Payment.findAll({ where: { userId, ...createdAtFilter }, include: [{ model: Package, as: 'package' }], order: [['createdAt', 'DESC']] }),
    Income.findAll({ where: { userId, ...createdAtFilter }, include: [{ model: Package, as: 'package' }], order: [['createdAt', 'DESC']] }),
    Withdrawal.findAll({ where: { userId, ...createdAtFilter }, order: [['createdAt', 'DESC']] })
  ]);

  const rows = [
    ...transactions.map((tx) => historyRow({
      id: tx.id,
      date: tx.createdAt,
      amount: tx.amount,
      status: 'completed',
      transactionType: tx.category,
      type: tx.type,
      remarks: tx.remarks,
      balanceAfter: tx.balanceAfter,
      finalCreditedAmount: tx.type === 'credit' ? tx.amount : 0,
      source: 'wallet'
    })),
    ...payments.map((payment) => historyRow({
      id: payment.id,
      date: payment.createdAt,
      amount: payment.amount,
      status: payment.status,
      transactionType: 'subscription_payment',
      type: 'debit',
      remarks: payment.package ? `${payment.package.name} subscription payment` : 'Subscription payment',
      source: withPaymentProof(payment)
    })),
    ...incomes.map((income) => historyRow({
      id: income.id,
      date: income.createdAt,
      amount: income.amount,
      status: income.status,
      transactionType: income.type === 'task' ? 'advertisement_earning' : `${income.type}_earning`,
      type: 'credit',
      remarks: income.remarks,
      finalCreditedAmount: income.amount,
      source: 'income'
    })),
    ...withdrawals.map((withdrawal) => historyRow({
      id: withdrawal.id,
      date: withdrawal.createdAt,
      amount: withdrawal.amount,
      status: withdrawal.status,
      transactionType: 'withdrawal_request',
      type: 'debit',
      remarks: withdrawal.adminRemarks || 'Withdrawal request',
      finalCreditedAmount: withdrawal.status === 'paid' ? withdrawal.amount : 0,
      source: 'withdrawal'
    }))
  ];

  return rows
    .filter((row) => !query.status || row.status === query.status)
    .filter((row) => !query.transactionType || row.transactionType === query.transactionType)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

exports.buildHistory = buildHistory;

exports.summary = asyncHandler(async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  const transactions = await buildHistory(req.user.id, req.query);
  res.json({ wallet, transactions });
});

exports.transactions = asyncHandler(async (req, res) => {
  const transactions = await buildHistory(req.user.id, req.query);
  res.json({ transactions });
});

exports.upsertBank = asyncHandler(async (req, res) => {
  const [bankDetail, created] = await BankDetail.findOrCreate({
    where: { userId: req.user.id },
    defaults: { userId: req.user.id, ...req.body }
  });
  if (!created && bankDetail.accountNumber && req.body.accountNumber && bankDetail.accountNumber !== req.body.accountNumber) {
    throw new ApiError(403, 'Bank account number is locked after first submission. Please contact support for changes.');
  }
  await bankDetail.update(req.body);
  res.json({ bankDetail });
});

exports.bank = asyncHandler(async (req, res) => {
  const bankDetail = await BankDetail.findOne({ where: { userId: req.user.id } });
  res.json({ bankDetail });
});
