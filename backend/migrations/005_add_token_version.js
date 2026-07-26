const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.addColumn('Admins', 'tokenVersion', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    }).catch(() => { /* column already exists — ignore */ });

    await queryInterface.addColumn('Patients', 'tokenVersion', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    }).catch(() => { /* column already exists — ignore */ });
  },

  async down() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn('Admins', 'tokenVersion').catch(() => {});
    await queryInterface.removeColumn('Patients', 'tokenVersion').catch(() => {});
  },
};
