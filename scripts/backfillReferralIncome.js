const { Op } = require('sequelize');
const { sequelize, Payment, User, Package, Income, IncomeSetting } = require('../src/models');
const { creditReferralIncome, buildReferralChain } = require('../src/services/referral.service');

const apply = process.argv.includes('--apply');
const MAX_LEVELS = 10;

async function previewReferralChain(user) {
  const rows = [];
  let parentId = user.referredById;
  let level = 1;

  while (parentId && level <= MAX_LEVELS) {
    const parent = await User.findByPk(parentId, { attributes: ['id', 'referredById'] });
    if (!parent) break;
    rows.push({ parentUserId: parent.id, childUserId: user.id, level });
    parentId = parent.referredById;
    level += 1;
  }

  return rows;
}

async function main() {
  const payments = await Payment.findAll({
    where: { status: 'approved' },
    include: [
      { model: User, as: 'user' },
      { model: Package, as: 'package' }
    ],
    order: [['approvedAt', 'ASC'], ['createdAt', 'ASC']]
  });

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    approvedPayments: payments.length,
    skipped: 0,
    alreadyCreditedPayments: 0,
    paymentsNeedingCredit: 0,
    noReferralChain: 0,
    noActiveCommissionSetting: 0,
    incomesCreated: 0,
    details: []
  };

  for (const payment of payments) {
    if (!payment.user || !payment.package) {
      summary.skipped += 1;
      continue;
    }

    const existingCount = await Income.count({
      where: {
        paymentId: payment.id,
        type: 'referral'
      }
    });

    if (existingCount > 0) {
      summary.alreadyCreditedPayments += 1;
      continue;
    }

    summary.paymentsNeedingCredit += 1;

    const referrals = await previewReferralChain(payment.user);
    if (!referrals.length) {
      summary.noReferralChain += 1;
      summary.details.push({
        paymentId: payment.id,
        user: payment.user.email || payment.user.mobile || payment.user.name,
        package: payment.package.name,
        reason: 'No referral chain found'
      });
      continue;
    }

    const settingsCount = await IncomeSetting.count({
      where: {
        status: 'active',
        level: { [Op.in]: referrals.map((item) => item.level) },
        [Op.or]: [{ packageId: payment.packageId }, { packageId: null }]
      }
    });

    if (!settingsCount) {
      summary.noActiveCommissionSetting += 1;
      summary.details.push({
        paymentId: payment.id,
        user: payment.user.email || payment.user.mobile || payment.user.name,
        package: payment.package.name,
        referralLevels: referrals.map((item) => item.level),
        reason: 'No active commission setting for this package/level'
      });
      continue;
    }

    if (!apply) continue;

    await sequelize.transaction(async (transaction) => {
      const credited = await creditReferralIncome({
        user: payment.user,
        packageRecord: payment.package,
        payment
      }, { transaction });
      summary.incomesCreated += credited.length;
    });
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to create missing referral income and wallet transactions.');
  }
}

main()
  .catch((error) => {
    console.error('Referral income backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
