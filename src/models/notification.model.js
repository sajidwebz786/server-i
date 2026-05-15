const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.ENUM('task', 'payment', 'withdrawal', 'income', 'support', 'general'), allowNull: false, defaultValue: 'general' },
  data: { type: DataTypes.JSONB, allowNull: true },
  readAt: { type: DataTypes.DATE, allowNull: true }
});

module.exports = Notification;
