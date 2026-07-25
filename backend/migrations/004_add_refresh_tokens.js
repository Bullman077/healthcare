const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.addColumn('Admins', 'refreshToken', {
      type: DataTypes.STRING,
      allowNull: true,
    }).catch(() => { /* column already exists — ignore */ });

    await queryInterface.addColumn('Patients', 'refreshToken', {
      type: DataTypes.STRING,
      allowNull: true,
    }).catch(() => { /* column already exists — ignore */ });
  },

  async down() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn('Admins', 'refreshToken').catch(() => {});
    await queryInterface.removeColumn('Patients', 'refreshToken').catch(() => {});
  },
};
