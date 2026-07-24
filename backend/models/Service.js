const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Service = sequelize.define('Service', {
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  price: { type: DataTypes.FLOAT, defaultValue: 0 },
  category: {
    type: DataTypes.ENUM('physical', 'wellness', 'training', 'therapy', 'preventive', 'telehealth', 'diagnostic'),
    allowNull: false,
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  requiresPreparation: { type: DataTypes.BOOLEAN, defaultValue: false },
  preparationInstructions: { type: DataTypes.TEXT },
  color: { type: DataTypes.STRING(7), defaultValue: '#6A3FA0' },
  icon: { type: DataTypes.STRING(100) },
}, {
  timestamps: true,
});

module.exports = Service;
