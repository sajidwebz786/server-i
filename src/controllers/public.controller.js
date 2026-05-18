const { Op } = require('sequelize');
const { Banner, Package, Task } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

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
    packages,
    latestTasks
  });
});
