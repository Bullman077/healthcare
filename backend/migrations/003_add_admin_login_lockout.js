const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const queryInterface = sequelize.getQueryInterface();

    // Add profilePhoto to Admins if it doesn't exist (migration 002 added lastLoginIp — this adds brute-force fields)
    await queryInterface.addColumn('Admins', 'loginAttempts', {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    }).catch(() => { /* column already exists — ignore */ });

    await queryInterface.addColumn('Admins', 'loginLockedUntil', {
      type: DataTypes.DATE,
      allowNull: true,
    }).catch(() => { /* column already exists — ignore */ });
  },

  async down() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn('Admins', 'loginAttempts').catch(() => {});
    await queryInterface.removeColumn('Admins', 'loginLockedUntil').catch(() => {});
  },
};
