const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.addColumn('Patients', 'loginAttempts', {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    }).catch(() => { /* column already exists */ });

    await queryInterface.addColumn('Patients', 'loginLockedUntil', {
      type: DataTypes.DATE,
      allowNull: true,
    }).catch(() => { /* column already exists */ });
  },

  async down() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn('Patients', 'loginAttempts').catch(() => {});
    await queryInterface.removeColumn('Patients', 'loginLockedUntil').catch(() => {});
  },
};
