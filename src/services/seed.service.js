const { User, Package, IncomeSetting, Wallet } = require('../models');
const { env } = require('../config/env');
const { makeReferralCode } = require('../utils/referralCode');

async function seedDefaults() {
  const packages = [
    { name: '₹999 Plan', oldName: '₹1,000 Plan', baseAmount: 999, taxAmount: 125, finalAmount: 1124, minAdsRequired: 15, dailyAdsRequired: 15, dailyWorkMinutes: 30, monthlyGenerationAmount: 300, dailyDebitAmount: 10, freeBannerCount: 1 },
    { name: '₹1,999 Plan', oldName: '₹2,000 Plan', baseAmount: 1999, taxAmount: 125, finalAmount: 2124, minAdsRequired: 30, dailyAdsRequired: 30, dailyWorkMinutes: 60, monthlyGenerationAmount: 500, dailyDebitAmount: 16.67, freeBannerCount: 2 },
    { name: '₹2,999 Plan', oldName: '₹3,000 Plan', baseAmount: 2999, taxAmount: 125, finalAmount: 3124, minAdsRequired: 60, dailyAdsRequired: 60, dailyWorkMinutes: 120, monthlyGenerationAmount: 700, dailyDebitAmount: 23.33, freeBannerCount: 3 }
  ];

  const createdPackages = [];
  for (const item of packages) {
    const { oldName, ...defaults } = item;
    const record = await Package.findOne({ where: { name: item.name } })
      || await Package.findOne({ where: { name: oldName } })
      || await Package.create(defaults);
    const updates = {};
    if (record.name !== item.name) updates.name = item.name;
    for (const key of Object.keys(defaults)) {
      if (key !== 'name' && Number(record[key] || 0) !== Number(item[key] || 0)) updates[key] = item[key];
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
    { level: 6, percentage: 1 },
    { level: 7, percentage: 1 },
    { level: 8, percentage: 1 },
    { level: 9, percentage: 1 },
    { level: 10, percentage: 1 }
  ];

  for (const pkg of createdPackages) {
    for (const setting of percentages) {
      await IncomeSetting.findOrCreate({
        where: { packageId: pkg.id, level: setting.level },
        defaults: { packageId: pkg.id, ...setting }
      });
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
