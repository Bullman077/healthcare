const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const qi = sequelize.getQueryInterface();
    await qi.addColumn('Admins', 'lastLoginIp', {
      type: DataTypes.STRING(45),
      allowNull: true,
    });
  },

  async down() {
    const qi = sequelize.getQueryInterface();
    await qi.removeColumn('Admins', 'lastLoginIp');
  },
};
