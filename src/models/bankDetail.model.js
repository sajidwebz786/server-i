const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankDetail = sequelize.define('BankDetail', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  bankName: { type: DataTypes.STRING, allowNull: true },
  accountHolderName: { type: DataTypes.STRING, allowNull: true },
  accountNumber: { type: DataTypes.STRING, allowNull: true },
  ifscCode: { type: DataTypes.STRING, allowNull: true },
  upiId: { type: DataTypes.STRING, allowNull: true },
  panNumber: { type: DataTypes.STRING, allowNull: true },
  aadhaarNumber: { type: DataTypes.STRING, allowNull: true }
});

module.exports = BankDetail;
