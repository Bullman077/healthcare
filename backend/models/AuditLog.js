const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  adminEmail: { type: DataTypes.STRING(255), allowNull: false },
  action: { type: DataTypes.STRING(100), allowNull: false },
  resource: { type: DataTypes.STRING(50), allowNull: false },
  resourceId: { type: DataTypes.STRING(50) },
  details: { type: DataTypes.JSONB, defaultValue: {} },
  ipAddress: { type: DataTypes.STRING(45) },
}, {
  timestamps: true,
  indexes: [
    { fields: ['adminId'] },
    { fields: ['action'] },
    { fields: ['resource'] },
    { fields: ['createdAt'] },
  ],
});

module.exports = AuditLog;
