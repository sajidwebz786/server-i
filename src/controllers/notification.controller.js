const { Op } = require('sequelize');
const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { [Op.or]: [{ userId: req.user.id }, { userId: null }] },
    order: [['createdAt', 'DESC']],
    limit: 50
  });
  res.json({ notifications });
});

exports.markRead = asyncHandler(async (req, res) => {
  const [updated] = await Notification.update(
    { readAt: new Date() },
    {
      where: {
        id: req.params.id,
        [Op.or]: [{ userId: req.user.id }, { userId: null }]
      }
    }
  );
  res.json({ updated });
});
