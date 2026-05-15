const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IncomeSetting = sequelize.define('IncomeSetting', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  packageId: { type: DataTypes.UUID, allowNull: true },
  level: { type: DataTypes.INTEGER, allowNull: false },
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' }
}, {
  indexes: [
    { unique: true, fields: ['package_id', 'level'] }
  ]
});

module.exports = IncomeSetting;
