const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  platform: {
    type: DataTypes.ENUM('youtube', 'instagram', 'facebook', 'google', 'website', 'whatsapp', 'banner', 'local', 'other'),
    allowNull: false
  },
  taskUrl: { type: DataTypes.TEXT, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  rewardAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  packageId: { type: DataTypes.UUID, allowNull: true },
  startsAt: { type: DataTypes.DATE, allowNull: true },
  endsAt: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'inactive', 'expired'), allowNull: false, defaultValue: 'active' }
});

module.exports = Task;
