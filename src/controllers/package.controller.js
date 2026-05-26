const { Package, IncomeSetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const defaultPackages = [
  { name: '1K Package', baseAmount: 999, taxAmount: 125, finalAmount: 1124, minAdsRequired: 0, freeBannerCount: 1, status: 'active' },
  { name: '2K Package', baseAmount: 1999, taxAmount: 125, finalAmount: 2124, minAdsRequired: 0, freeBannerCount: 2, status: 'active' },
  { name: '3K Package', baseAmount: 2999, taxAmount: 125, finalAmount: 3124, minAdsRequired: 0, freeBannerCount: 3, status: 'active' }
];

async function ensureDefaultPackages() {
  for (const item of defaultPackages) {
    const [record] = await Package.findOrCreate({ where: { name: item.name }, defaults: item });
    const updates = {};
    if (record.status !== 'active') updates.status = 'active';
    if (Number(record.freeBannerCount || 0) !== item.freeBannerCount) updates.freeBannerCount = item.freeBannerCount;
    if (Object.keys(updates).length) await record.update(updates);
  }
}

exports.list = asyncHandler(async (req, res) => {
  await ensureDefaultPackages();
  const where = req.user && req.user.role === 'admin' ? {} : { status: 'active' };
  const packages = await Package.findAll({
    where,
    include: [{ model: IncomeSetting, as: 'incomeSettings' }],
    order: [['finalAmount', 'ASC']]
  });
  res.json({ packages });
});

exports.create = asyncHandler(async (req, res) => {
  const record = await Package.create(req.body);
  res.status(201).json({ package: record });
});

exports.update = asyncHandler(async (req, res) => {
  const record = await Package.findByPk(req.params.id);
  if (!record) throw new ApiError(404, 'Package not found');
  await record.update(req.body);
  res.json({ package: record });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const record = await Package.findByPk(req.params.id);
  if (!record) throw new ApiError(404, 'Package not found');
  await record.update({ status: req.body.status });
  res.json({ package: record });
});

exports.remove = asyncHandler(async (req, res) => {
  const record = await Package.findByPk(req.params.id);
  if (!record) throw new ApiError(404, 'Package not found');
  await record.destroy();
  res.status(204).send();
});

exports.upsertIncomeSettings = asyncHandler(async (req, res) => {
  const pkg = await Package.findByPk(req.params.id);
  if (!pkg) throw new ApiError(404, 'Package not found');

  const settings = [];
  for (const item of req.body.settings) {
    const [setting] = await IncomeSetting.findOrCreate({
      where: { packageId: pkg.id, level: item.level },
      defaults: { packageId: pkg.id, level: item.level, percentage: item.percentage, status: item.status || 'active' }
    });
    await setting.update({ percentage: item.percentage, status: item.status || setting.status });
    settings.push(setting);
  }

  res.json({ settings });
});
