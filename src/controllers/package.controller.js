const { Package, IncomeSetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { PLAN_CONFIG, planDefaults, earningPerAdForPackage } = require('../utils/plans');

async function ensureDefaultPackages() {
  for (const item of PLAN_CONFIG) {
    const defaults = planDefaults(item);
    const record = await Package.findOne({ where: { name: item.name } })
      || await Package.findOne({ where: { name: item.oldName } })
      || await Package.create(defaults);
    const updates = {};
    if (record.name !== item.name) updates.name = item.name;
    for (const key of ['baseAmount', 'taxAmount', 'finalAmount', 'minAdsRequired', 'dailyAdsRequired', 'dailyWorkMinutes', 'monthlyGenerationAmount', 'dailyDebitAmount', 'freeBannerCount']) {
      if (Number(record[key] || 0) !== Number(defaults[key] || 0)) updates[key] = defaults[key];
    }
    if (record.status !== defaults.status) updates.status = defaults.status;
    if (Object.keys(updates).length) await record.update(updates);
  }
  await Package.update(
    { status: 'inactive' },
    { where: { name: ['1K Package', '2K Package', '3K Package', '₹1,000 Plan', '₹2,000 Plan', '₹3,000 Plan'] } }
  );
}

exports.list = asyncHandler(async (req, res) => {
  await ensureDefaultPackages();
  const where = req.user && req.user.role === 'admin' ? {} : { status: 'active' };
  const packages = await Package.findAll({
    where,
    include: [{ model: IncomeSetting, as: 'incomeSettings' }],
    order: [['finalAmount', 'ASC']]
  });
  res.json({
    packages: packages.map((pkg) => ({
      ...pkg.toJSON(),
      totalAdvertisements: Number(pkg.dailyAdsRequired || pkg.minAdsRequired || 0),
      earningPerAdvertisement: earningPerAdForPackage(pkg)
    }))
  });
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
  await record.update({ status: 'inactive' });
  res.json({ package: record, message: 'Package deactivated successfully' });
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
