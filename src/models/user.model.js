const bcrypt = require('bcryptjs');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  mobile: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: true },
  avatarUrl: { type: DataTypes.STRING, allowNull: true },
  referralCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  referredById: { type: DataTypes.UUID, allowNull: true },
  packageId: { type: DataTypes.UUID, allowNull: true },
  role: { type: DataTypes.ENUM('admin', 'user'), allowNull: false, defaultValue: 'user' },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive', 'blocked'),
    allowNull: false,
    defaultValue: 'pending'
  },
  isMobileVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isEmailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true }
}, {
  hooks: {
    beforeValidate: (user) => {
      if (user.email) user.email = String(user.email).trim().toLowerCase();
      if (user.mobile) user.mobile = String(user.mobile).replace(/\D/g, '');
    },
    beforeCreate: async (user) => {
      if (user.password) user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10);
    }
  },
  defaultScope: {
    attributes: { exclude: ['password'] }
  },
  scopes: {
    withPassword: {}
  }
});

User.prototype.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = User;
