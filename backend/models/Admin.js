const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'superadmin'), defaultValue: 'admin' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  profilePhoto: { type: DataTypes.STRING(500) },
  lastLogin: { type: DataTypes.DATE },
  lastLoginIp: { type: DataTypes.STRING(45) },
  // Brute-force protection — DB-backed so it survives restarts & PM2 cluster mode
  loginAttempts: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  loginLockedUntil: { type: DataTypes.DATE, allowNull: true },
  refreshToken: { type: DataTypes.STRING, allowNull: true },
  tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
}, {
  timestamps: true,
  hooks: {
    beforeSave: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcrypt.hash(admin.password, 12);
      }
    },
  },
});

Admin.prototype.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = Admin;
