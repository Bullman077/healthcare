const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const crypto = require('crypto');

const Appointment = sequelize.define('Appointment', {
  referenceNumber: { type: DataTypes.STRING(10), unique: true },
  provider: { type: DataTypes.STRING(100), defaultValue: 'Nacole Brown MSN AGPCNP-BC' },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  time: {
    type: DataTypes.ENUM(
      '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
      '4:00 PM', '5:00 PM'
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled', 'completed', 'no-show'),
    defaultValue: 'confirmed',
  },
  duration: { type: DataTypes.INTEGER, defaultValue: 30 },
  notes: { type: DataTypes.TEXT },
  patientNotes: { type: DataTypes.TEXT },
  paid: { type: DataTypes.BOOLEAN, defaultValue: false },
  remindersSent: { type: DataTypes.JSONB, defaultValue: [] },
  confirmedAt: { type: DataTypes.DATE },
  cancelledAt: { type: DataTypes.DATE },
  cancellationReason: { type: DataTypes.TEXT },
}, {
  timestamps: true,
  getterMethods: {
    dateFormatted() {
      return new Date(this.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    },
  },
  hooks: {
    beforeValidate: (appt) => {
      if (appt.isNewRecord && !appt.referenceNumber) {
        appt.referenceNumber = 'UHS' + crypto.randomInt(100000, 999999);
      }
    },
    beforeSave: (appt) => {
      if (appt.changed('status')) {
        if (appt.status === 'confirmed' && !appt.confirmedAt) {
          appt.confirmedAt = new Date();
        }
        if (appt.status === 'cancelled' && !appt.cancelledAt) {
          appt.cancelledAt = new Date();
        }
      }
    },
  },
});

module.exports = Appointment;
