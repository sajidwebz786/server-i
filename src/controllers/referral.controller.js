const { Referral, User, Package, Income } = require('../models');
const { getTree } = require('../services/referral.service');
const asyncHandler = require('../utils/asyncHandler');

exports.myTree = asyncHandler(async (req, res) => {
  const tree = await getTree(req.user.id, Number(req.query.depth || 5));
  res.json({ tree });
});

exports.adminTree = asyncHandler(async (req, res) => {
  const tree = await getTree(req.params.userId, Number(req.query.depth || 5));
  res.json({ tree });
});

exports.downline = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const referrals = await Referral.findAll({
    where: { parentUserId: userId },
    include: [
      { model: User, as: 'child', include: [{ model: Package, as: 'package' }] },
      { model: Package, as: 'package' }
    ],
    order: [['level', 'ASC'], ['createdAt', 'DESC']]
  });
  res.json({ referrals });
});

exports.myIncomes = asyncHandler(async (req, res) => {
  const incomes = await Income.findAll({
    where: { userId: req.user.id },
    include: [{ model: User, as: 'fromUser' }, { model: Package, as: 'package' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ incomes });
});
