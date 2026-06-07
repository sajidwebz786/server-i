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
const { runDailyDebits } = require('../services/dailyDebit.service');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function dateKey(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}

function addDailyRow(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      date: key,
      registrations: 0,
      collectionAmount: 0,
      distributedAmount: 0,
      paidWithdrawalAmount: 0,
      profitAmount: 0
    });
  }
  return map.get(key);
}

exports.dashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    totalPackages,
    pendingPayments,
    packageSales,
    pendingPaymentAmount,
    totalIncome,
    paidWithdrawals,
    walletLiability,
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
    Payment.sum('amount', { where: { status: 'pending' } }),
    Income.sum('amount', { where: { status: 'approved' } }),
    Withdrawal.sum('amount', { where: { status: 'paid' } }),
    Wallet.sum('availableBalance'),
    Withdrawal.count({ where: { status: 'pending' } }),
    UserTask.count({ where: { status: 'submitted' } }),
    SupportTicket.count({ where: { status: { [Op.ne]: 'closed' } } })
  ]);

  const collected = money(packageSales);
  const distributed = money(totalIncome);
  const paidOut = money(paidWithdrawals);
  const payableLiability = money(walletLiability);

  res.json({
    totals: {
      totalUsers,
      activeUsers,
      pendingUsers,
      totalPackages,
      pendingPayments,
      packageSales: packageSales || 0,
      pendingPaymentAmount: pendingPaymentAmount || 0,
      totalIncome: distributed,
      paidWithdrawals: paidOut,
      walletLiability: payableLiability,
      profitAmount: money(collected - distributed),
      cashAfterPaidWithdrawals: money(collected - paidOut),
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
      { model: Payment, as: 'payments', include: [{ model: Package, as: 'package' }] },
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
  const since = new Date();
  since.setDate(since.getDate() - Number(req.query.days || 90));

  const [
    incomeByType,
    withdrawalsByStatus,
    transactions,
    users,
    payments,
    incomes,
    withdrawals,
    packageRows
  ] = await Promise.all([
    Income.findAll({
      attributes: ['type', [fn('SUM', col('amount')), 'total']],
      where: { status: 'approved' },
      group: ['type']
    }),
    Withdrawal.findAll({
      attributes: ['status', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
      group: ['status']
    }),
    Transaction.findAll({ order: [['createdAt', 'DESC']], limit: 50 }),
    User.findAll({ where: { role: 'user', createdAt: { [Op.gte]: since } }, attributes: ['id', 'createdAt'] }),
    Payment.findAll({ where: { status: 'approved', approvedAt: { [Op.gte]: since } }, include: [{ model: Package, as: 'package' }, { model: User, as: 'user' }] }),
    Income.findAll({ where: { status: 'approved', createdAt: { [Op.gte]: since } } }),
    Withdrawal.findAll({ where: { status: 'paid', paidAt: { [Op.gte]: since } }, include: [{ model: User, as: 'user' }] }),
    Payment.findAll({ where: { status: 'approved' }, include: [{ model: Package, as: 'package' }] })
  ]);

  const dailyMap = new Map();
  for (const user of users) {
    addDailyRow(dailyMap, dateKey(user.createdAt)).registrations += 1;
  }
  for (const payment of payments) {
    const row = addDailyRow(dailyMap, dateKey(payment.approvedAt || payment.createdAt));
    row.collectionAmount = money(row.collectionAmount + money(payment.amount));
  }
  for (const income of incomes) {
    const row = addDailyRow(dailyMap, dateKey(income.createdAt));
    row.distributedAmount = money(row.distributedAmount + money(income.amount));
  }
  for (const withdrawal of withdrawals) {
    const row = addDailyRow(dailyMap, dateKey(withdrawal.paidAt || withdrawal.updatedAt));
    row.paidWithdrawalAmount = money(row.paidWithdrawalAmount + money(withdrawal.amount));
  }
  const dailyBusiness = [...dailyMap.values()]
    .map((row) => ({ ...row, profitAmount: money(row.collectionAmount - row.distributedAmount) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const packageMap = new Map();
  for (const payment of packageRows) {
    const key = payment.package?.name || 'Package';
    if (!packageMap.has(key)) packageMap.set(key, { packageName: key, registrations: 0, collectionAmount: 0 });
    const row = packageMap.get(key);
    row.registrations += 1;
    row.collectionAmount = money(row.collectionAmount + money(payment.amount));
  }
  const packagePerformance = [...packageMap.values()].sort((a, b) => b.collectionAmount - a.collectionAmount);

  const recentRegistrations = await User.findAll({
    where: { role: 'user', createdAt: { [Op.gte]: since } },
    attributes: ['id', 'name', 'email', 'mobile', 'status', 'createdAt', 'referralCode', 'isEmailVerified', 'isMobileVerified'],
    include: [
      { model: Package, as: 'package' },
      { model: Wallet, as: 'wallet' },
      { model: User, as: 'sponsor' }
    ],
    order: [['createdAt', 'DESC']]
  });

  const transactionRows = transactions.map((tx) => tx.toJSON ? tx.toJSON() : tx);
  const totalCollection = money(packageRows.reduce((sum, payment) => sum + money(payment.amount), 0));
  const totalDistributed = money(await Income.sum('amount', { where: { status: 'approved' } }));
  const totalPaidWithdrawals = money(await Withdrawal.sum('amount', { where: { status: 'paid' } }));

  res.json({
    incomeByType,
    withdrawalsByStatus,
    recentTransactions: transactionRows,
    recentRegistrations,
    profitSnapshot: {
      totalCollection,
      totalDistributed,
      totalPaidWithdrawals,
      profitAmount: money(totalCollection - totalDistributed),
      cashAfterPaidWithdrawals: money(totalCollection - totalPaidWithdrawals)
    },
    dailyBusiness,
    packagePerformance,
    distributionReport: (incomeByType || []).map((item) => ({ type: item.type, amount: money(item.get ? item.get('total') : item.total) })),
    withdrawalReport: (withdrawalsByStatus || []).map((item) => ({ status: item.status, count: Number(item.get ? item.get('count') : item.count || 0), amount: money(item.get ? item.get('total') : item.total) }))
  });
});

exports.createBanner = asyncHandler(async (req, res) => {
  const imageUrl = req.file ? `/uploads/banners/${req.file.filename}` : req.body.imageUrl;
  if (!imageUrl) throw new ApiError(400, 'Banner image is required');
  const banner = await Banner.create({
    ...req.body,
    imageUrl
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

exports.runDailyDebits = asyncHandler(async (req, res) => {
  const result = await runDailyDebits(req.body.date);
  res.json(result);
});
