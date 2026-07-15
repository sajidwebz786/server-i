const { Op } = require('sequelize');
const { Payment, Package, Task, UserTask } = require('../models');
const { earningPerAdForPackage } = require('../utils/plans');

const FREE_AD_LIMIT = 10;
const FREE_AD_REWARD = 0.5;

function isActive(user, payment) {
  if (!payment) return false;
  const startDate = payment?.approvedAt || payment?.createdAt || user.createdAt;
  const expiresAt = payment?.subscriptionExpiresAt || new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000);
  return user.status === 'active' && (!expiresAt || new Date(expiresAt) >= new Date());
}

async function subscriptionSummaryForUser(user, options = {}) {
  const payment = await Payment.findOne({
    where: { userId: user.id, status: 'approved' },
    include: [{ model: Package, as: 'package' }],
    order: [['approvedAt', 'DESC'], ['createdAt', 'DESC']],
    transaction: options.transaction
  });

  const packageRecord = payment?.package || user.package || null;
  const approvedPayments = await Payment.findAll({
    where: { userId: user.id, status: 'approved' },
    include: [{ model: Package, as: 'package' }],
    order: [['approvedAt', 'DESC'], ['createdAt', 'DESC']],
    transaction: options.transaction
  });

  const startDate = payment?.approvedAt || payment?.createdAt || user.createdAt;
  const taskWhere = {
    status: 'active',
    ...(packageRecord ? { [Op.or]: [{ packageId: packageRecord.id }, { packageId: null }] } : { packageId: null })
  };
  const totalAdvertisements = packageRecord ? Number(packageRecord.dailyAdsRequired || packageRecord.minAdsRequired || 20) : FREE_AD_LIMIT;
  const allocatedTaskIds = await Task.findAll({
    where: taskWhere,
    attributes: ['id'],
    order: [['createdAt', 'ASC']],
    limit: totalAdvertisements,
    transaction: options.transaction
  }).then((rows) => rows.map((row) => row.id));

  const completedWhere = {
    userId: user.id,
    watchPercent: { [Op.gte]: 100 }
  };
  if (allocatedTaskIds.length) completedWhere.taskId = { [Op.in]: allocatedTaskIds };
  if (startDate) completedWhere.createdAt = { [Op.gte]: startDate };

  const advertisementsCompleted = allocatedTaskIds.length
    ? await UserTask.count({ where: completedWhere, transaction: options.transaction })
    : 0;
  const remainingAdvertisements = Math.max(totalAdvertisements - advertisementsCompleted, 0);

  return {
    planName: packageRecord?.name || 'Free Joiner',
    planAmount: packageRecord ? Number(packageRecord.baseAmount || payment?.amount || 0) : 0,
    payableAmount: packageRecord ? Number(packageRecord.finalAmount || payment?.amount || 0) : 0,
    planStartDate: startDate,
    planExpiryDate: payment?.subscriptionExpiresAt || new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000),
    status: packageRecord ? (isActive(user, payment) ? 'active' : 'inactive') : 'free',
    totalAdvertisements,
    remainingAdvertisements,
    advertisementsCompleted,
    remainingTasks: remainingAdvertisements,
    earningPerAdvertisement: packageRecord ? earningPerAdForPackage(packageRecord) : FREE_AD_REWARD,
    paymentId: payment?.id || null,
    activePlans: approvedPayments.filter((item) => {
      const itemStart = item.approvedAt || item.createdAt;
      const expiry = item.subscriptionExpiresAt || (itemStart && new Date(new Date(itemStart).getTime() + 30 * 24 * 60 * 60 * 1000));
      return expiry && new Date(expiry) >= new Date();
    }).map((item) => ({
      paymentId: item.id,
      packageId: item.packageId,
      planName: item.package?.name || 'Plan',
      planStartDate: item.approvedAt || item.createdAt,
      planExpiryDate: item.subscriptionExpiresAt || new Date(new Date(item.approvedAt || item.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    }))
  };
}

async function attachSubscriptionSummaries(users) {
  return Promise.all(users.map(async (user) => {
    const plain = user.toJSON ? user.toJSON() : user;
    return {
      ...plain,
      subscription: await subscriptionSummaryForUser(user)
    };
  }));
}

module.exports = {
  subscriptionSummaryForUser,
  attachSubscriptionSummaries
};
