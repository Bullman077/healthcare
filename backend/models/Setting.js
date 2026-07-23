const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  value: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.STRING(255) },
}, {
  timestamps: true,
});

module.exports = Setting;
