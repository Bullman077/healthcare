const { Op } = require('sequelize');
const { Patient, Service, Appointment } = require('../models');
const { sequelize } = require('../config/db');
const { sendConfirmation } = require('../utils/email');
const { AppError } = require('../middleware/errorHandler');

const iLike = sequelize.dialect.name === 'sqlite' ? Op.like : Op.iLike;

exports.createAppointment = async (req, res, next) => {
  try {
    const { name, phone, email, service: serviceName, date, time, message } = req.body;

    const service = await Service.findOne({
      where: {
        name: { [iLike]: serviceName.trim() },
        isActive: true,
      },
    });
    if (!service) {
      return next(new AppError(`Service "${serviceName}" not found or is inactive.`, 404));
    }

    let patient = req.patient || await Patient.findOne({ where: { email: email.toLowerCase() } });

    if (patient) {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;
      let needsUpdate = false;
      if (patient.firstName !== firstName) { patient.firstName = firstName; needsUpdate = true; }
      if (patient.lastName !== lastName) { patient.lastName = lastName; needsUpdate = true; }
      if (patient.phone !== phone) { patient.phone = phone; needsUpdate = true; }
      if (needsUpdate) await patient.save();
    } else {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;
      patient = await Patient.create({ firstName, lastName, phone, email: email.toLowerCase() });
    }

    const existing = await Appointment.findOne({
      where: { patientId: patient.id, date, time, status: 'confirmed' },
    });
    if (existing) {
      return next(new AppError('You already have a confirmed booking for this date and time.', 409));
    }

    const slotTaken = await Appointment.findOne({
      where: { date, time, status: { [Op.in]: ['confirmed'] } },
    });
    if (slotTaken) {
      return next(new AppError('This time slot is already booked. Please choose a different time.', 409));
    }

    let appointment;
    let retries = 0;
    while (retries < 3) {
      try {
        appointment = await Appointment.create({
          patientId: patient.id,
          serviceId: service.id,
          date, time,
          duration: service.duration,
          patientNotes: message || '',
        });
        break;
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' && err.fields?.referencenumber && retries < 2) {
          retries++;
          continue;
        }
        throw err;
      }
    }
    if (!appointment) {
      return next(new AppError('Unable to generate unique reference number. Please try again.', 500));
    }

    const populated = await Appointment.findByPk(appointment.id, {
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name', 'duration'] },
      ],
    });

    try {
      await sendConfirmation(populated);
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: {
        referenceNumber: populated.referenceNumber,
        patient: populated.patient.fullName,
        service: populated.service.name,
        date: populated.date,
        time: populated.time,
        status: populated.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentsByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return next(new AppError('Email query parameter is required.', 400));

    const patient = await Patient.findOne({ where: { email: email.toLowerCase() } });
    if (!patient) return res.json({ success: true, data: [] });

    const appointments = await Appointment.findAll({
      where: { patientId: patient.id },
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name', 'duration'] },
      ],
      order: [['date', 'DESC'], ['time', 'DESC']],
    });

    res.json({
      success: true,
      data: appointments.map(a => ({
        referenceNumber: a.referenceNumber,
        patient: a.patient.fullName,
        service: a.service.name,
        date: a.date,
        time: a.time,
        status: a.status,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentByRef = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      where: { referenceNumber: req.params.ref },
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name', 'duration', 'price'] },
      ],
    });

    if (!appointment) {
      return next(new AppError('No appointment found with that reference number.', 404));
    }

    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};
