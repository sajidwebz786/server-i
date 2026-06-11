const { Op } = require('sequelize');
const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const rows = await Notification.findAll({
    where: { [Op.or]: [{ userId: req.user.id }, { userId: null }] },
    order: [['createdAt', 'DESC']],
    limit: 50
  });
  const notifications = rows.map((row) => {
    const item = row.toJSON();
    if (!item.userId && Array.isArray(item.data?.readBy) && item.data.readBy.includes(req.user.id)) {
      item.readAt = item.data.readAtBy?.[req.user.id] || item.updatedAt || item.createdAt;
    }
    return item;
  });
  res.json({ notifications });
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: {
      id: req.params.id,
      [Op.or]: [{ userId: req.user.id }, { userId: null }]
    }
  });
  if (!notification) return res.json({ updated: 0 });

  if (notification.userId) {
    await notification.update({ readAt: new Date() });
    return res.json({ updated: 1 });
  }

  const data = notification.data || {};
  const readBy = Array.isArray(data.readBy) ? data.readBy : [];
  const readAtBy = data.readAtBy && typeof data.readAtBy === 'object' ? data.readAtBy : {};
  if (!readBy.includes(req.user.id)) readBy.push(req.user.id);
  readAtBy[req.user.id] = new Date().toISOString();
  await notification.update({ data: { ...data, readBy, readAtBy } });
  res.json({ updated: 1 });
});
