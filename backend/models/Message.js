const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Message = sequelize.define('Message', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  subject: { type: DataTypes.STRING(200) },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  timestamps: true,
  indexes: [{ fields: ['isRead'] }],
});

module.exports = Message;
