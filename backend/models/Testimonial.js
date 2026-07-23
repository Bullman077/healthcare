const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Testimonial = sequelize.define('Testimonial', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  title: { type: DataTypes.STRING(100) },
  content: { type: DataTypes.TEXT, allowNull: false },
  rating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  displayOnHome: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  timestamps: true,
});

module.exports = Testimonial;
