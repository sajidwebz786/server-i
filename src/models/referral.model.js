const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  parentUserId: { type: DataTypes.UUID, allowNull: false },
  childUserId: { type: DataTypes.UUID, allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: false },
  packageId: { type: DataTypes.UUID, allowNull: true }
}, {
  indexes: [
    { unique: true, fields: ['parent_user_id', 'child_user_id', 'level'] }
  ]
});

module.exports = Referral;
