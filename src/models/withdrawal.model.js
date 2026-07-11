const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  bankSnapshot: { type: DataTypes.JSONB, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'processing', 'rejected', 'paid'), allowNull: false, defaultValue: 'pending' },
  adminRemarks: { type: DataTypes.TEXT, allowNull: true },
  transactionNumber: { type: DataTypes.STRING, allowNull: true },
  timeline: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  approvedById: { type: DataTypes.UUID, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  paidAt: { type: DataTypes.DATE, allowNull: true }
});

module.exports = Withdrawal;
