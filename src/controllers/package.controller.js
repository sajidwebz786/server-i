const { Package, IncomeSetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const defaultPackages = [
  { name: '₹1,000 Plan', baseAmount: 1000, taxAmount: 0, finalAmount: 1000, minAdsRequired: 15, dailyAdsRequired: 15, dailyWorkMinutes: 30, monthlyGenerationAmount: 300, dailyDebitAmount: 10, freeBannerCount: 1, status: 'active' },
  { name: '₹2,000 Plan', baseAmount: 2000, taxAmount: 0, finalAmount: 2000, minAdsRequired: 30, dailyAdsRequired: 30, dailyWorkMinutes: 60, monthlyGenerationAmount: 500, dailyDebitAmount: 16.67, freeBannerCount: 2, status: 'active' },
  { name: '₹3,000 Plan', baseAmount: 3000, taxAmount: 0, finalAmount: 3000, minAdsRequired: 60, dailyAdsRequired: 60, dailyWorkMinutes: 120, monthlyGenerationAmount: 700, dailyDebitAmount: 23.33, freeBannerCount: 3, status: 'active' }
];

async function ensureDefaultPackages() {
  for (const item of defaultPackages) {
    const [record] = await Package.findOrCreate({ where: { name: item.name }, defaults: item });
    const updates = {};
    for (const key of ['baseAmount', 'taxAmount', 'finalAmount', 'minAdsRequired', 'dailyAdsRequired', 'dailyWorkMinutes', 'monthlyGenerationAmount', 'dailyDebitAmount', 'freeBannerCount']) {
      if (Number(record[key] || 0) !== Number(item[key] || 0)) updates[key] = item[key];
    }
    if (record.status !== item.status) updates.status = item.status;
    if (Object.keys(updates).length) await record.update(updates);
  }
  await Package.update({ status: 'inactive' }, { where: { name: ['1K Package', '2K Package', '3K Package'] } });
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
