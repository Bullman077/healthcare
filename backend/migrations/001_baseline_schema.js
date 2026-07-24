const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

module.exports = {
  async up() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable('Admins', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      role: { type: DataTypes.ENUM('admin', 'superadmin'), defaultValue: 'admin' },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      lastLogin: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Patients', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
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
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Services', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(100), unique: true },
      description: { type: DataTypes.TEXT },
      duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      price: { type: DataTypes.FLOAT, defaultValue: 0 },
      category: {
        type: DataTypes.ENUM('physical', 'wellness', 'training', 'therapy', 'preventive', 'telehealth', 'diagnostic'),
        allowNull: false,
      },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      requiresPreparation: { type: DataTypes.BOOLEAN, defaultValue: false },
      preparationInstructions: { type: DataTypes.TEXT },
      color: { type: DataTypes.STRING(7), defaultValue: '#6A3FA0' },
      icon: { type: DataTypes.STRING(100) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Appointments', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      referenceNumber: { type: DataTypes.STRING(10), unique: true },
      patientId: { type: DataTypes.INTEGER, references: { model: 'Patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      serviceId: { type: DataTypes.INTEGER, references: { model: 'Services', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      provider: { type: DataTypes.STRING(100), defaultValue: 'Nacole Brown MSN AGPCNP-BC' },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      time: {
        type: DataTypes.ENUM('8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'),
        allowNull: false,
      },
      status: { type: DataTypes.ENUM('confirmed', 'cancelled', 'completed', 'no-show'), defaultValue: 'confirmed' },
      duration: { type: DataTypes.INTEGER, defaultValue: 30 },
      notes: { type: DataTypes.TEXT },
      patientNotes: { type: DataTypes.TEXT },
      meetingUrl: { type: DataTypes.STRING(500) },
      paid: { type: DataTypes.BOOLEAN, defaultValue: false },
      remindersSent: { type: DataTypes.JSONB, defaultValue: [] },
      confirmedAt: { type: DataTypes.DATE },
      cancelledAt: { type: DataTypes.DATE },
      cancellationReason: { type: DataTypes.TEXT },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Messages', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false },
      phone: { type: DataTypes.STRING(20) },
      subject: { type: DataTypes.STRING(200) },
      message: { type: DataTypes.TEXT, allowNull: false },
      isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
      repliedAt: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Testimonials', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      title: { type: DataTypes.STRING(100) },
      content: { type: DataTypes.TEXT, allowNull: false },
      rating: { type: DataTypes.INTEGER },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      displayOnHome: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('Settings', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value: { type: DataTypes.TEXT, allowNull: false },
      description: { type: DataTypes.STRING(255) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('AuditLogs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      adminId: { type: DataTypes.INTEGER, allowNull: false },
      adminEmail: { type: DataTypes.STRING(255), allowNull: false },
      action: { type: DataTypes.STRING(100), allowNull: false },
      resource: { type: DataTypes.STRING(50), allowNull: false },
      resourceId: { type: DataTypes.STRING(50) },
      details: { type: DataTypes.JSONB, defaultValue: {} },
      ipAddress: { type: DataTypes.STRING(45) },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('AuditLogs', ['adminId']);
    await queryInterface.addIndex('AuditLogs', ['action']);
    await queryInterface.addIndex('AuditLogs', ['resource']);
    await queryInterface.addIndex('AuditLogs', ['createdAt']);
  },

  async down() {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable('AuditLogs');
    await queryInterface.dropTable('Settings');
    await queryInterface.dropTable('Testimonials');
    await queryInterface.dropTable('Messages');
    await queryInterface.dropTable('Appointments');
    await queryInterface.dropTable('Services');
    await queryInterface.dropTable('Patients');
    await queryInterface.dropTable('Admins');
  },
};
