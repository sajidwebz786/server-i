const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  packageId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  paymentMode: { type: DataTypes.ENUM('gateway', 'upi', 'manual', 'cash'), allowNull: false, defaultValue: 'manual' },
  gatewayOrderId: { type: DataTypes.STRING, allowNull: true },
  gatewayPaymentId: { type: DataTypes.STRING, allowNull: true },
  utrNumber: { type: DataTypes.STRING, allowNull: true },
  screenshot: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
  adminRemarks: { type: DataTypes.TEXT, allowNull: true },
  approvedById: { type: DataTypes.UUID, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true }
});

module.exports = Payment;
