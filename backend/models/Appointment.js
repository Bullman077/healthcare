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
  indexes: [
    { fields: ['date'] },
    { fields: ['status'] },
    { fields: ['createdAt'] },
    { fields: ['patientId'] },
    { fields: ['serviceId'] },
  ],
  getterMethods: {
    dateFormatted() {
      // Anchor to noon to prevent UTC→local timezone rollover (e.g. '2025-08-15' parsing
      // as UTC midnight and displaying as Aug 14 in US Eastern/Central/Pacific time zones).
      return new Date(this.date + 'T12:00:00').toLocaleDateString('en-US', {
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
