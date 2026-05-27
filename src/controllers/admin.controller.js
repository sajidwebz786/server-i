const { Op, fn, col } = require('sequelize');
const {
  User,
  Package,
  Payment,
  Withdrawal,
  UserTask,
  SupportTicket,
  Income,
  Wallet,
  BankDetail,
  Transaction,
  Banner,
  Notification
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.dashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    totalPackages,
    pendingPayments,
    packageSales,
    totalIncome,
    pendingWithdrawals,
    pendingTaskApprovals,
    openTickets
  ] = await Promise.all([
    User.count({ where: { role: 'user' } }),
    User.count({ where: { role: 'user', status: 'active' } }),
    User.count({ where: { role: 'user', status: 'pending' } }),
    Package.count(),
    Payment.count({ where: { status: 'pending' } }),
    Payment.sum('amount', { where: { status: 'approved' } }),
    Income.sum('amount', { where: { status: 'approved' } }),
    Withdrawal.count({ where: { status: 'pending' } }),
    UserTask.count({ where: { status: 'submitted' } }),
    SupportTicket.count({ where: { status: { [Op.ne]: 'closed' } } })
  ]);

  res.json({
    totals: {
      totalUsers,
      activeUsers,
      pendingUsers,
      totalPackages,
      pendingPayments,
      packageSales: packageSales || 0,
      totalIncome: totalIncome || 0,
      pendingWithdrawals,
      pendingTaskApprovals,
      openTickets
    }
  });
});

exports.users = asyncHandler(async (req, res) => {
  const where = { role: 'user' };
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${req.query.search}%` } },
      { email: { [Op.iLike]: `%${req.query.search}%` } },
      { mobile: { [Op.iLike]: `%${req.query.search}%` } },
      { referralCode: { [Op.iLike]: `%${req.query.search}%` } }
    ];
  }

  const users = await User.findAll({
    where,
    include: [
      { model: Package, as: 'package' },
      { model: Wallet, as: 'wallet' },
      { model: BankDetail, as: 'bankDetail' },
      { model: User, as: 'sponsor' }
    ],
    order: [['createdAt', 'DESC']]
  });
  res.json({ users });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const allowed = ['name', 'email', 'mobile', 'status', 'packageId', 'isMobileVerified', 'isEmailVerified'];
  const patch = {};
  for (const key of allowed) if (req.body[key] !== undefined) patch[key] = req.body[key];
  if (patch.email !== undefined) {
    patch.email = String(patch.email || '').trim().toLowerCase();
    const duplicate = await User.findOne({ where: { email: patch.email, id: { [Op.ne]: user.id } } });
    if (duplicate) throw new ApiError(409, 'User email already exists in our database.');
  }
  if (patch.mobile !== undefined) {
    patch.mobile = String(patch.mobile || '').replace(/\D/g, '');
    const duplicate = await User.findOne({ where: { mobile: patch.mobile, id: { [Op.ne]: user.id } } });
    if (duplicate) throw new ApiError(409, 'User phone number already exists in our database.');
  }
  await user.update(patch);
  res.json({ user });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.scope('withPassword').findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await user.update({ password: req.body.password });
  res.json({ message: 'Password reset successfully' });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user || user.role !== 'user') throw new ApiError(404, 'User not found');
  await user.update({ status: 'blocked' });
  res.json({ message: 'User access removed successfully', user });
});

exports.reports = asyncHandler(async (req, res) => {
  const incomeByType = await Income.findAll({
    attributes: ['type', [fn('SUM', col('amount')), 'total']],
    group: ['type']
  });
  const withdrawalsByStatus = await Withdrawal.findAll({
    attributes: ['status', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
    group: ['status']
  });
  const transactions = await Transaction.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
  res.json({ incomeByType, withdrawalsByStatus, recentTransactions: transactions });
});

exports.createBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.create({
    ...req.body,
    imageUrl: req.file ? `/uploads/banners/${req.file.filename}` : req.body.imageUrl
  });
  res.status(201).json({ banner });
});

exports.updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);
  if (!banner) throw new ApiError(404, 'Banner not found');
  await banner.update({
    ...req.body,
    imageUrl: req.file ? `/uploads/banners/${req.file.filename}` : req.body.imageUrl || banner.imageUrl
  });
  res.json({ banner });
});

exports.deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);
  if (!banner) throw new ApiError(404, 'Banner not found');
  await banner.destroy();
  res.status(204).send();
});

exports.banners = asyncHandler(async (req, res) => {
  const banners = await Banner.findAll({ order: [['createdAt', 'DESC']] });
  res.json({ banners });
});

exports.notifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { [Op.or]: [{ userId: req.user.id }, { userId: null }] },
    order: [['createdAt', 'DESC']]
  });
  res.json({ notifications });
});

exports.broadcast = asyncHandler(async (req, res) => {
  const notification = await Notification.create({
    userId: req.body.userId || null,
    title: req.body.title,
    body: req.body.body,
    type: req.body.type || 'general',
    data: req.body.data || null
  });
  res.status(201).json({ notification });
});
