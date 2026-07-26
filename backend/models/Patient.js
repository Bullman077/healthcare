const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const Patient = sequelize.define('Patient', {
  firstName: { type: DataTypes.STRING(50), allowNull: false },
  lastName: { type: DataTypes.STRING(50), allowNull: false },
  dateOfBirth: { type: DataTypes.DATEONLY },
  phone: { type: DataTypes.STRING(20), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255) },
  address: { type: DataTypes.JSONB },
  insurance: { type: DataTypes.JSONB },
  emergencyContact: { type: DataTypes.JSONB },
  medicalHistory: { type: DataTypes.TEXT },
  allergies: { type: DataTypes.JSONB, defaultValue: [] },
  medications: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.ENUM('active', 'inactive', 'archived'), defaultValue: 'active' },
  notes: { type: DataTypes.TEXT },
  progressNotes: { type: DataTypes.TEXT },
  medicalProgress: { type: DataTypes.JSONB, defaultValue: [] },
  reminders: { type: DataTypes.JSONB, defaultValue: [] },
  resetPasswordToken: { type: DataTypes.STRING(255) },
  resetPasswordExpires: { type: DataTypes.DATE },
  refreshToken: { type: DataTypes.STRING(255) },
  tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
}, {
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['status'] },
    { fields: ['createdAt'] },
  ],
  getterMethods: {
    fullName() { return `${this.firstName} ${this.lastName}`; },
  },
});

Patient.prototype.comparePassword = async function (enteredPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

Patient.prototype.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

module.exports = Patient;

