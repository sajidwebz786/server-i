const { Op } = require('sequelize');
const { Banner, Package, Task } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { earningPerAdForPackage } = require('../utils/plans');

function presentPackage(pkg) {
  const plain = pkg.toJSON ? pkg.toJSON() : pkg;
  const totalAdvertisements = Number(plain.totalAdvertisements || plain.dailyAdsRequired || plain.minAdsRequired || 0);
  const earningPerAdvertisement = earningPerAdForPackage(plain);
  return {
    ...plain,
    minAdsRequired: totalAdvertisements,
    dailyAdsRequired: totalAdvertisements,
    totalAdvertisements,
    earningPerAdvertisement,
    monthlyGenerationAmount: totalAdvertisements && earningPerAdvertisement
      ? Number((totalAdvertisements * earningPerAdvertisement * 30).toFixed(2))
      : Number(plain.monthlyGenerationAmount || 0)
  };
}

exports.home = asyncHandler(async (req, res) => {
  const [banners, packages, latestTasks] = await Promise.all([
    Banner.findAll({ where: { status: 'active', placement: { [Op.in]: ['home', 'mobile'] } }, order: [['createdAt', 'DESC']] }),
    Package.findAll({ where: { status: 'active' }, order: [['finalAmount', 'ASC']] }),
    Task.findAll({ where: { status: 'active' }, order: [['createdAt', 'DESC']], limit: 6 })
  ]);

  res.json({
    company: {
      name: 'Luminate Ads',
      positioning: 'Smart advertising, referral hierarchy, and task-based earning ecosystem',
      services: [
        'Advertising Promotion',
        'Digital Marketing',
        'Brand Promotion',
        'Sales Promotion',
        'Event Promotion',
        'Influencer Promotion',
        'Outdoor Promotion',
        'Referral Promotion',
        'PR Promotion',
        'Email/SMS Promotion',
        'Affiliate Promotion',
        'Local Area Promotion'
      ]
    },
    banners,
    packages: packages.map(presentPackage),
    latestTasks
  });
});
