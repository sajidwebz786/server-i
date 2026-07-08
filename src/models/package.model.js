const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Package = sequelize.define('Package', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  baseAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  finalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  minAdsRequired: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  dailyAdsRequired: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  earningPerAdvertisement: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  dailyWorkMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  monthlyGenerationAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  dailyDebitAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  freeBannerCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' }
});

module.exports = Package;
