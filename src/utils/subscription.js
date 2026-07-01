const { Op } = require('sequelize');
const { Package, Payment, Task, UserTask } = require('../models');
const { earningPerAdForPackage } = require('./plans');

function dateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

async function subscriptionSummary(user, options = {}) {
  const transaction = options.transaction;
  const approvedPayment = await Payment.findOne({
    where: { userId: user.id, status: 'approved' },
    include: [{ model: Package, as: 'package' }],
    order: [['approvedAt', 'DESC'], ['createdAt', 'DESC']],
    transaction
  });

  const plan = user.package || approvedPayment?.package || null;
  const active = Boolean(plan && user.status === 'active' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) >= new Date()));
  const totalAdvertisements = plan ? Number(plan.dailyAdsRequired || plan.minAdsRequired || 20) : 0;
  const packageWhere = plan
    ? { status: 'active', [Op.or]: [{ packageId: null }, { packageId: plan.id }] }
    : { status: 'active', packageId: null };

  const activeTasks = plan ? await Task.findAll({
    where: packageWhere,
    attributes: ['id'],
    transaction
  }) : [];
  const taskIds = activeTasks.map((task) => task.id);
  const completedAdvertisements = taskIds.length ? await UserTask.count({
    where: {
      userId: user.id,
      taskId: { [Op.in]: taskIds },
      watchPercent: { [Op.gte]: 100 }
    },
    transaction
  }) : 0;

  const cappedCompleted = Math.min(completedAdvertisements, totalAdvertisements);
  return {
    planName: plan?.name || null,
    planAmount: plan ? Number(plan.baseAmount || 0) : 0,
    payableAmount: plan ? Number(plan.finalAmount || plan.baseAmount || 0) : 0,
    earningPerAdvertisement: plan ? earningPerAdForPackage(plan) : 0,
    planStartDate: dateOnly(approvedPayment?.approvedAt || approvedPayment?.createdAt),
    planExpiryDate: dateOnly(user.subscriptionExpiresAt),
    status: active ? 'active' : 'inactive',
    totalAdvertisements,
    advertisementsCompleted: cappedCompleted,
    remainingAdvertisements: Math.max(totalAdvertisements - cappedCompleted, 0),
    remainingTasks: Math.max(totalAdvertisements - cappedCompleted, 0),
    approvedPaymentId: approvedPayment?.id || null
  };
}

module.exports = { subscriptionSummary };
