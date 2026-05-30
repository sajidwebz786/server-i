const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  walletId: { type: DataTypes.UUID, allowNull: false },
  incomeId: { type: DataTypes.UUID, allowNull: true },
  withdrawalId: { type: DataTypes.UUID, allowNull: true },
  referenceDate: { type: DataTypes.DATEONLY, allowNull: true },
  type: { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
  category: { type: DataTypes.ENUM('referral_income', 'task_income', 'bonus', 'withdrawal', 'refund', 'adjustment'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  balanceAfter: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  remarks: { type: DataTypes.TEXT, allowNull: true }
});

module.exports = Transaction;
