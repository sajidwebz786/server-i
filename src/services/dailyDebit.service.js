const { Op } = require('sequelize');
const { sequelize, User, Package, Payment, Task, UserTask, Transaction } = require('../models');
const { debitAdjustment, money } = require('./wallet.service');

function toDateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

async function countCompletedAds(user, packageId, dateKey, transaction) {
  return UserTask.count({
    where: {
      userId: user.id,
      taskDate: dateKey,
      status: { [Op.in]: ['submitted', 'approved'] }
    },
    include: [{
      model: Task,
      as: 'task',
      required: true,
      where: { [Op.or]: [{ packageId: null }, { packageId }] }
    }],
    transaction
  });
}

async function hasDebit(userId, packageName, dateKey, transaction) {
  const existing = await Transaction.findOne({
    where: {
      userId,
      referenceDate: dateKey,
      type: 'debit',
      category: 'adjustment',
      remarks: { [Op.like]: `Daily ad debit for ${dateKey} (${packageName})%` }
    },
    transaction
  });
  return Boolean(existing);
}

async function runDailyDebits(targetDate) {
  const dateKey = targetDate ? toDateKey(targetDate) : yesterdayKey();
  const todayKey = toDateKey();
  if (dateKey >= todayKey) {
    return { date: dateKey, processed: 0, debited: 0, skipped: 0, results: [], message: 'Daily debit can run only for past dates.' };
  }

  const users = await User.findAll({
    where: { role: 'user', status: 'active' },
    include: [{
      model: Payment,
      as: 'payments',
      where: { status: 'approved' },
      include: [{ model: Package, as: 'package', where: { status: 'active' } }]
    }]
  });

  const results = [];
  await sequelize.transaction(async (transaction) => {
    for (const user of users) {
      const approvedPackages = new Map();
      for (const payment of user.payments || []) {
        if (payment.package) approvedPackages.set(payment.package.id, payment.package);
      }

      for (const pkg of [...approvedPackages.values()].sort((a, b) => Number(a.baseAmount || 0) - Number(b.baseAmount || 0))) {
        const required = Number(pkg.dailyAdsRequired || pkg.minAdsRequired || 0);
        const debitAmount = money(pkg.dailyDebitAmount);
        if (!required || !debitAmount) {
          results.push({ userId: user.id, name: user.name, packageName: pkg.name, status: 'skipped', completedAds: 0, requiredAds: required, debitAmount: 0 });
          continue;
        }

        const completedAds = await countCompletedAds(user, pkg.id, dateKey, transaction);
        if (completedAds >= required) {
          results.push({ userId: user.id, name: user.name, packageName: pkg.name, status: 'completed', completedAds, requiredAds: required, debitAmount: 0 });
          continue;
        }

        if (await hasDebit(user.id, pkg.name, dateKey, transaction)) {
          results.push({ userId: user.id, name: user.name, packageName: pkg.name, status: 'already_debited', completedAds, requiredAds: required, debitAmount: 0 });
          continue;
        }

        await debitAdjustment({
          userId: user.id,
          amount: debitAmount,
          referenceDate: dateKey,
          remarks: `Daily ad debit for ${dateKey} (${pkg.name}): completed ${completedAds}/${required} tasks`
        }, { transaction });
        results.push({ userId: user.id, name: user.name, packageName: pkg.name, status: 'debited', completedAds, requiredAds: required, debitAmount });
      }
    }
  });

  return {
    date: dateKey,
    processed: results.length,
    debited: results.filter((item) => item.status === 'debited').length,
    skipped: results.filter((item) => item.status !== 'debited').length,
    results
  };
}

module.exports = { runDailyDebits, toDateKey };
