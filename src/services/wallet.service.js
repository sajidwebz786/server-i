const { Wallet, Transaction, Income } = require('../models');
const ApiError = require('../utils/apiError');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function ensureWallet(userId, options = {}) {
  const [wallet] = await Wallet.findOrCreate({
    where: { userId },
    defaults: { userId },
    transaction: options.transaction
  });
  return wallet;
}

async function creditIncome({ userId, amount, category, incomePayload, remarks, referenceDate }, options = {}) {
  const transaction = options.transaction;
  const wallet = await ensureWallet(userId, { transaction });
  const creditAmount = money(amount);

  const income = await Income.create(incomePayload, { transaction });
  const totalEarned = money(wallet.totalEarned) + creditAmount;
  const availableBalance = money(wallet.availableBalance) + creditAmount;

  await wallet.update({ totalEarned, availableBalance }, { transaction });
  await Transaction.create({
    userId,
    walletId: wallet.id,
    incomeId: income.id,
    referenceDate: referenceDate || null,
    type: 'credit',
    category,
    amount: creditAmount,
    balanceAfter: availableBalance,
    remarks
  }, { transaction });

  return { wallet, income };
}

async function reserveWithdrawal(userId, amount, withdrawalId, options = {}) {
  const transaction = options.transaction;
  const wallet = await ensureWallet(userId, { transaction });
  const withdrawalAmount = money(amount);

  if (money(wallet.availableBalance) < withdrawalAmount) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  const availableBalance = money(wallet.availableBalance) - withdrawalAmount;
  const pendingWithdrawal = money(wallet.pendingWithdrawal) + withdrawalAmount;

  await wallet.update({ availableBalance, pendingWithdrawal }, { transaction });
  await Transaction.create({
    userId,
    walletId: wallet.id,
    withdrawalId,
    type: 'debit',
    category: 'withdrawal',
    amount: withdrawalAmount,
    balanceAfter: availableBalance,
    remarks: 'Withdrawal request reserved'
  }, { transaction });

  return wallet;
}

async function debitAdjustment({ userId, amount, remarks, referenceDate }, options = {}) {
  const transaction = options.transaction;
  const wallet = await ensureWallet(userId, { transaction });
  const debitAmount = money(amount);
  const availableBalance = money(wallet.availableBalance) - debitAmount;

  await wallet.update({ availableBalance }, { transaction });
  await Transaction.create({
    userId,
    walletId: wallet.id,
    referenceDate: referenceDate || null,
    type: 'debit',
    category: 'adjustment',
    amount: debitAmount,
    balanceAfter: availableBalance,
    remarks
  }, { transaction });

  return wallet;
}

async function releaseWithdrawal(userId, amount, options = {}) {
  const transaction = options.transaction;
  const wallet = await ensureWallet(userId, { transaction });
  await wallet.update({
    availableBalance: money(wallet.availableBalance) + money(amount),
    pendingWithdrawal: Math.max(money(wallet.pendingWithdrawal) - money(amount), 0)
  }, { transaction });
  return wallet;
}

async function markWithdrawalPaid(userId, amount, options = {}) {
  const transaction = options.transaction;
  const wallet = await ensureWallet(userId, { transaction });
  await wallet.update({
    pendingWithdrawal: Math.max(money(wallet.pendingWithdrawal) - money(amount), 0),
    withdrawnAmount: money(wallet.withdrawnAmount) + money(amount)
  }, { transaction });
  return wallet;
}

module.exports = {
  money,
  ensureWallet,
  creditIncome,
  debitAdjustment,
  reserveWithdrawal,
  releaseWithdrawal,
  markWithdrawalPaid
};
