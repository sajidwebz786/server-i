const { Op } = require('sequelize');
const { Payment, Package, Task, UserTask } = require('../models');
const { earningPerAdForPackage } = require('../utils/plans');

function isActive(user, payment) {
  if (!payment) return false;
  const expiresAt = user.subscriptionExpiresAt || payment.subscriptionExpiresAt;
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
  if (!packageRecord) {
    return {
      planName: null,
      planAmount: 0,
      planStartDate: null,
      planExpiryDate: user.subscriptionExpiresAt || null,
      status: 'inactive',
      totalAdvertisements: 0,
      remainingAdvertisements: 0,
      advertisementsCompleted: 0,
      remainingTasks: 0,
      earningPerAdvertisement: 0
    };
  }

  const startDate = payment?.approvedAt || payment?.createdAt || user.createdAt;
  const taskWhere = {
    status: 'active',
    [Op.or]: [{ packageId: packageRecord.id }, { packageId: null }]
  };
  const totalAdvertisements = Number(packageRecord.dailyAdsRequired || packageRecord.minAdsRequired || 20);
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
    planName: packageRecord.name,
    planAmount: Number(packageRecord.baseAmount || payment?.amount || 0),
    payableAmount: Number(packageRecord.finalAmount || payment?.amount || 0),
    planStartDate: startDate,
    planExpiryDate: user.subscriptionExpiresAt || null,
    status: isActive(user, payment) ? 'active' : 'inactive',
    totalAdvertisements,
    remainingAdvertisements,
    advertisementsCompleted,
    remainingTasks: remainingAdvertisements,
    earningPerAdvertisement: earningPerAdForPackage(packageRecord),
    paymentId: payment?.id || null
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
