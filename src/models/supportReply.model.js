const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupportReply = sequelize.define('SupportReply', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ticketId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isAdminReply: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
});

module.exports = SupportReply;
