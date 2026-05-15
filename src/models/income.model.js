const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Income = sequelize.define('Income', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  fromUserId: { type: DataTypes.UUID, allowNull: true },
  packageId: { type: DataTypes.UUID, allowNull: true },
  paymentId: { type: DataTypes.UUID, allowNull: true },
  userTaskId: { type: DataTypes.UUID, allowNull: true },
  type: { type: DataTypes.ENUM('referral', 'task', 'bonus', 'adjustment'), allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: true },
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'approved' },
  remarks: { type: DataTypes.TEXT, allowNull: true }
});

module.exports = Income;
