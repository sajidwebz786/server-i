const { Package, IncomeSetting } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.list = asyncHandler(async (req, res) => {
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
