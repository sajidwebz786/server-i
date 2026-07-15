const { Op } = require('sequelize');
const { Package, Payment, Task, UserTask } = require('../models');
const { earningPerAdForPackage } = require('./plans');

const FREE_AD_LIMIT = 10;
const FREE_AD_REWARD = 0.5;

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
  const planStart = approvedPayment?.approvedAt || approvedPayment?.createdAt || null;
  const calculatedExpiry = planStart ? new Date(new Date(planStart).getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const planExpiry = approvedPayment?.subscriptionExpiresAt || calculatedExpiry;
  const approvedPayments = await Payment.findAll({
    where: { userId: user.id, status: 'approved' },
    include: [{ model: Package, as: 'package' }],
    order: [['approvedAt', 'DESC'], ['createdAt', 'DESC']],
    transaction
  });
  const now = new Date();
  const plans = approvedPayments.map((payment) => {
    const start = payment.approvedAt || payment.createdAt;
    const expiry = payment.subscriptionExpiresAt || (start && new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000));
    return {
      paymentId: payment.id,
      packageId: payment.packageId,
      planName: payment.package?.name || 'Plan',
      planAmount: Number(payment.package?.baseAmount || 0),
      payableAmount: Number(payment.amount || payment.package?.finalAmount || 0),
      planStartDate: dateOnly(start),
      planExpiryDate: dateOnly(expiry),
      status: expiry && new Date(expiry) >= now ? 'active' : 'expired'
    };
  });
  const activePlans = plans.filter((item) => item.status === 'active');
  const active = Boolean(plan && user.status === 'active' && (!planExpiry || new Date(planExpiry) >= new Date()));
  const freePayoutEligibleAt = new Date(new Date(user.createdAt || Date.now()).getTime() + 30 * 24 * 60 * 60 * 1000);
  const totalAdvertisements = plan ? Number(plan.dailyAdsRequired || plan.minAdsRequired || 20) : FREE_AD_LIMIT;
  const packageWhere = plan
    ? { status: 'active', packageId: plan.id }
    : { status: 'active', packageId: null };

  const activeTasks = await Task.findAll({
    where: packageWhere,
    attributes: ['id'],
    limit: totalAdvertisements,
    transaction
  });
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
    planName: plan?.name || 'Free Joiner',
    planAmount: plan ? Number(plan.baseAmount || 0) : 0,
    payableAmount: plan ? Number(plan.finalAmount || plan.baseAmount || 0) : 0,
    earningPerAdvertisement: plan ? earningPerAdForPackage(plan) : FREE_AD_REWARD,
    planStartDate: dateOnly(planStart),
    planExpiryDate: dateOnly(planExpiry),
    status: active ? 'active' : 'free',
    freePayoutEligibleAt: dateOnly(freePayoutEligibleAt),
    freePayoutEligible: Boolean(active || freePayoutEligibleAt <= new Date()),
    totalAdvertisements,
    advertisementsCompleted: cappedCompleted,
    remainingAdvertisements: Math.max(totalAdvertisements - cappedCompleted, 0),
    remainingTasks: Math.max(totalAdvertisements - cappedCompleted, 0),
    approvedPaymentId: approvedPayment?.id || null,
    plans,
    activePlans
  };
}

module.exports = { subscriptionSummary };
