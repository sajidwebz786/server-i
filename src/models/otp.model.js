const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Otp = sequelize.define('Otp', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  channel: { type: DataTypes.ENUM('mobile', 'email', 'whatsapp'), allowNull: false },
  target: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false },
  purpose: { type: DataTypes.ENUM('register', 'login', 'reset_password'), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: true }
});

module.exports = Otp;
