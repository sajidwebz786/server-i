const { User, Package, IncomeSetting, Wallet } = require('../models');
const { env } = require('../config/env');
const { makeReferralCode } = require('../utils/referralCode');
const { PLAN_CONFIG, planDefaults } = require('../utils/plans');

async function seedDefaults() {
  const createdPackages = [];
  for (const item of PLAN_CONFIG) {
    const defaults = planDefaults(item);
    const record = await Package.findOne({ where: { name: item.name } })
      || await Package.findOne({ where: { name: item.oldName } })
      || await Package.create(defaults);
    const updates = {};
    if (record.name !== item.name) updates.name = item.name;
    for (const key of ['earningPerAdvertisement']) {
      if (!Number(record[key] || 0)) updates[key] = defaults[key];
    }
    if (Object.keys(updates).length) await record.update(updates);
    createdPackages.push(record);
  }
  await Package.update(
    { status: 'inactive' },
    { where: { name: ['1K Package', '2K Package', '3K Package', '₹1,000 Plan', '₹2,000 Plan', '₹3,000 Plan'] } }
  );

  const percentages = [
    { level: 1, percentage: 10 },
    { level: 2, percentage: 5 },
    { level: 3, percentage: 3 },
    { level: 4, percentage: 1 },
    { level: 5, percentage: 1 },
    { level: 6, percentage: 0.5 },
    { level: 7, percentage: 0.5 },
    { level: 8, percentage: 0.25 },
    { level: 9, percentage: 0.25 },
    { level: 10, percentage: 0.25 }
  ];

  for (const pkg of createdPackages) {
    for (const setting of percentages) {
      const [record] = await IncomeSetting.findOrCreate({
        where: { packageId: pkg.id, level: setting.level },
        defaults: { packageId: pkg.id, ...setting }
      });
      await record.update({ percentage: setting.percentage, status: 'active' });
    }
  }

  const [admin] = await User.scope('withPassword').findOrCreate({
    where: { email: env.adminEmail },
    defaults: {
      name: 'System Admin',
      email: env.adminEmail,
      mobile: '9999999999',
      password: env.adminPassword,
      referralCode: makeReferralCode('ADMIN'),
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      isMobileVerified: true
    }
  });

  await Wallet.findOrCreate({ where: { userId: admin.id }, defaults: { userId: admin.id } });
}

module.exports = { seedDefaults };
