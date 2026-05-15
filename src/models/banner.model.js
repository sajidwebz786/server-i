const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Banner = sequelize.define('Banner', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  linkUrl: { type: DataTypes.TEXT, allowNull: true },
  placement: { type: DataTypes.ENUM('home', 'dashboard', 'promotion', 'mobile'), allowNull: false, defaultValue: 'home' },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' }
});

module.exports = Banner;
