const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserTask = sequelize.define('UserTask', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  taskId: { type: DataTypes.UUID, allowNull: false },
  taskDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  screenshot: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'submitted', 'approved', 'rejected'), allowNull: false, defaultValue: 'submitted' },
  approvedById: { type: DataTypes.UUID, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  adminRemarks: { type: DataTypes.TEXT, allowNull: true }
}, {
  indexes: [
    { unique: true, fields: ['user_id', 'task_id', 'task_date'] }
  ]
});

module.exports = UserTask;
