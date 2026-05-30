const { User, Package, IncomeSetting, Wallet } = require('../models');
const { env } = require('../config/env');
const { makeReferralCode } = require('../utils/referralCode');

async function seedDefaults() {
  const packages = [
    { name: '₹1,000 Plan', baseAmount: 1000, taxAmount: 0, finalAmount: 1000, minAdsRequired: 15, dailyAdsRequired: 15, dailyWorkMinutes: 30, monthlyGenerationAmount: 300, dailyDebitAmount: 10, freeBannerCount: 1 },
    { name: '₹2,000 Plan', baseAmount: 2000, taxAmount: 0, finalAmount: 2000, minAdsRequired: 30, dailyAdsRequired: 30, dailyWorkMinutes: 60, monthlyGenerationAmount: 500, dailyDebitAmount: 16.67, freeBannerCount: 2 },
    { name: '₹3,000 Plan', baseAmount: 3000, taxAmount: 0, finalAmount: 3000, minAdsRequired: 60, dailyAdsRequired: 60, dailyWorkMinutes: 120, monthlyGenerationAmount: 700, dailyDebitAmount: 23.33, freeBannerCount: 3 }
  ];

  const createdPackages = [];
  for (const item of packages) {
    const [record] = await Package.findOrCreate({ where: { name: item.name }, defaults: item });
    const updates = {};
    for (const key of Object.keys(item)) {
      if (key !== 'name' && Number(record[key] || 0) !== Number(item[key] || 0)) updates[key] = item[key];
    }
    if (Object.keys(updates).length) await record.update(updates);
    createdPackages.push(record);
  }
  await Package.update({ status: 'inactive' }, { where: { name: ['1K Package', '2K Package', '3K Package'] } });

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
