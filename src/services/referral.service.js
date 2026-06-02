const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Referral,
  Income,
  IncomeSetting,
  Notification
} = require('../models');
const { creditIncome, money } = require('./wallet.service');

const MAX_LEVELS = 10;

async function buildReferralChain(user, packageId, options = {}) {
  const transaction = options.transaction;
  if (!user.referredById) return [];

  const existingRows = await Referral.findAll({
    where: { childUserId: user.id },
    transaction
  });
  if (existingRows.length) return existingRows;

  const rows = [];
  let parentId = user.referredById;
  let level = 1;

  while (parentId && level <= MAX_LEVELS) {
    const parent = await User.findByPk(parentId, { transaction });
    if (!parent) break;

    rows.push({ parentUserId: parent.id, childUserId: user.id, level, packageId });
    parentId = parent.referredById;
    level += 1;
  }

  if (rows.length) {
    await Referral.bulkCreate(rows, { transaction, ignoreDuplicates: true });
  }

  return Referral.findAll({ where: { childUserId: user.id }, transaction });
}

async function creditReferralIncome({ user, packageRecord, payment }, options = {}) {
  const transaction = options.transaction;
  const referrals = await buildReferralChain(user, packageRecord.id, { transaction });
  if (!referrals.length) return [];

  const settings = await IncomeSetting.findAll({
    where: {
      status: 'active',
      level: { [Op.in]: referrals.map((item) => item.level) },
      [Op.or]: [{ packageId: packageRecord.id }, { packageId: null }]
    },
    order: [['packageId', 'DESC']],
    transaction
  });

  const settingByLevel = new Map();
  for (const setting of settings) {
    if (!settingByLevel.has(setting.level)) settingByLevel.set(setting.level, setting);
  }

  const credited = [];
  for (const referral of referrals) {
    const existingIncome = await Income.findOne({
      where: {
        userId: referral.parentUserId,
        fromUserId: user.id,
        paymentId: payment.id,
        type: 'referral',
        level: referral.level
      },
      transaction
    });
    if (existingIncome) {
      credited.push(existingIncome);
      continue;
    }

    const setting = settingByLevel.get(referral.level);
    const percentage = setting ? money(setting.percentage) : 0;
    if (percentage <= 0) continue;

    const amount = money((money(packageRecord.baseAmount) * percentage) / 100);
    if (amount <= 0) continue;

    const result = await creditIncome({
      userId: referral.parentUserId,
      amount,
      category: 'referral_income',
      remarks: `Level ${referral.level} referral income from ${user.name}`,
      incomePayload: {
        userId: referral.parentUserId,
        fromUserId: user.id,
        packageId: packageRecord.id,
        paymentId: payment.id,
        type: 'referral',
        level: referral.level,
        percentage,
        amount,
        status: 'approved'
      }
    }, { transaction });

    await Notification.create({
      userId: referral.parentUserId,
      title: 'Referral income credited',
      body: `You earned ${amount} from level ${referral.level} referral.`,
      type: 'income',
      data: { incomeId: result.income.id, fromUserId: user.id }
    }, { transaction });

    credited.push(result.income);
  }

  return credited;
}

async function getTree(userId, depth = 5) {
  const user = await User.findByPk(userId, {
    include: [{ model: User, as: 'directReferrals', include: [{ model: User, as: 'directReferrals' }] }]
  });

  if (!user) return null;

  async function hydrate(node, level) {
    const plain = node.toJSON();
    if (level >= depth) {
      plain.directReferrals = [];
      return plain;
    }

    const children = await User.findAll({
      where: { referredById: node.id },
      include: [{ model: Package, as: 'package' }]
    }).catch(() => []);
    plain.directReferrals = await Promise.all(children.map((child) => hydrate(child, level + 1)));
    return plain;
  }

  const Package = require('../models').Package;
  return hydrate(user, 0);
}

module.exports = {
  buildReferralChain,
  creditReferralIncome,
  getTree
};
