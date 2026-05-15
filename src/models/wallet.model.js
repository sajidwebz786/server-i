const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  totalEarned: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  availableBalance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  withdrawnAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  pendingWithdrawal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
});

module.exports = Wallet;
