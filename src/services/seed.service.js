const { User, Package, IncomeSetting, Wallet } = require('../models');
const { env } = require('../config/env');
const { makeReferralCode } = require('../utils/referralCode');

async function seedDefaults() {
  const packages = [
    { name: '1K Package', baseAmount: 999, taxAmount: 125, finalAmount: 1124, minAdsRequired: 0, freeBannerCount: 1 },
    { name: '2K Package', baseAmount: 1999, taxAmount: 125, finalAmount: 2124, minAdsRequired: 0, freeBannerCount: 2 },
    { name: '3K Package', baseAmount: 2999, taxAmount: 125, finalAmount: 3124, minAdsRequired: 0, freeBannerCount: 3 }
  ];

  const createdPackages = [];
  for (const item of packages) {
    const [record] = await Package.findOrCreate({ where: { name: item.name }, defaults: item });
    if (Number(record.freeBannerCount || 0) !== item.freeBannerCount) await record.update({ freeBannerCount: item.freeBannerCount });
    createdPackages.push(record);
  }

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
