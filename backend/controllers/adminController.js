const jwt = require('jsonwebtoken');
const { Op, fn, col, literal } = require('sequelize');
const { Admin, Patient, Appointment, Service } = require('../models');
const { sequelize } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { sendStatusUpdate, sendFollowUpReminderEmail } = require('../utils/email');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password.', 400));
    }

    const admin = await Admin.findOne({ where: { email, isActive: true } });
    if (!admin || !(await admin.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    admin.lastLogin = new Date();
    await admin.save({ fields: ['lastLogin'] });

    const token = signToken(admin.id);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      signed: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('token', token, cookieOptions);

    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    admin: { id: req.admin.id, email: req.admin.email, name: req.admin.name, role: req.admin.role },
  });
};

exports.getAppointments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo, search } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { referenceNumber: { [Op.iLike]: term } },
        { '$patient.firstName$': { [Op.iLike]: term } },
        { '$patient.lastName$': { [Op.iLike]: term } },
        { '$patient.email$': { [Op.iLike]: term } },
      ];
    }

    const { count, rows } = await Appointment.findAndCountAll({
      where,
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name', 'duration', 'price'] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit, 10),
      distinct: true,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        pages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth'] },
        { association: 'service', attributes: ['name', 'duration', 'price', 'description'] },
      ],
    });
    if (!appointment) return next(new AppError('No appointment found with that ID.', 404));
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;
    if (!['confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
      return next(new AppError('Invalid status. Use: confirmed, cancelled, completed, or no-show.', 400));
    }

    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email'] },
        { association: 'service', attributes: ['name'] },
      ],
    });
    if (!appointment) return next(new AppError('No appointment found with that ID.', 404));

    appointment.status = status;
    if (status === 'cancelled') {
      appointment.cancelledAt = new Date();
      if (cancellationReason) appointment.cancellationReason = cancellationReason;
    }
    if (status === 'confirmed') {
      appointment.confirmedAt = new Date();
    }
    await appointment.save();

    try {
      await sendStatusUpdate(appointment);
    } catch (emailErr) {
      console.error('Status update email failed:', emailErr.message);
    }

    res.json({ success: true, message: `Appointment ${status} successfully.`, data: appointment });
  } catch (err) {
    next(err);
  }
};

exports.deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return next(new AppError('No appointment found with that ID.', 404));
    await appointment.destroy();
    res.json({ success: true, message: 'Appointment deleted permanently.' });
  } catch (err) {
    next(err);
  }
};

exports.exportAppointments = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    const where = {};

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name'] },
      ],
      order: [['date', 'DESC']],
    });

    const header = 'Reference Number,Patient Name,Email,Phone,Service,Date,Time,Status,Duration,Booked At';
    const rows = appointments.map((a) => {
      const p = a.patient || {};
      const s = a.service || {};
      const name = `"${(p.firstName || '') + ' ' + (p.lastName || '')}"`;
      return [
        a.referenceNumber, name, (p.email || ''), (p.phone || ''),
        `"${s.name || ''}"`,
        new Date(a.date).toISOString().split('T')[0],
        a.time, a.status, a.duration || '',
        new Date(a.createdAt).toISOString(),
      ].join(',');
    });

    const csv = header + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [totalPatients, totalAppointments, statusCounts, todayCount] = await Promise.all([
      Patient.count({ where: { status: 'active' } }),
      Appointment.count(),
      Appointment.findAll({
        attributes: ['status', [fn('COUNT', col('status')), 'count']],
        group: ['status'],
        raw: true,
      }),
      Appointment.count({
        where: { date: { [Op.between]: [todayStart, todayEnd] }, status: 'confirmed' },
      }),
    ]);

    const statusMap = { confirmed: 0, cancelled: 0, completed: 0, 'no-show': 0 };
    statusCounts.forEach((s) => { statusMap[s.status] = parseInt(s.count, 10); });

    res.json({
      success: true,
      data: {
        totalPatients, totalAppointments,
        confirmed: statusMap.confirmed, cancelled: statusMap.cancelled,
        completed: statusMap.completed, noShow: statusMap['no-show'],
        today: todayCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPatients = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: term } },
        { lastName: { [Op.iLike]: term } },
        { email: { [Op.iLike]: term } },
        { phone: { [Op.iLike]: term } },
      ];
    }

    const { count, rows } = await Patient.findAndCountAll({
      where, order: [['createdAt', 'DESC']], offset, limit: parseInt(limit, 10), distinct: true,
    });

    res.json({
      success: true, data: rows,
      pagination: {
        page: parseInt(page, 10), limit: parseInt(limit, 10), total: count,
        pages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return next(new AppError('No patient found with that ID.', 404));

    const appointments = await Appointment.findAll({
      where: { patientId: patient.id },
      include: [{ association: 'service', attributes: ['name'] }],
      order: [['date', 'DESC']],
      limit: 50,
    });

    res.json({ success: true, data: { patient, appointments } });
  } catch (err) {
    next(err);
  }
};

exports.updatePatient = async (req, res, next) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'dateOfBirth', 'phone', 'email',
      'address', 'insurance', 'emergencyContact',
      'medicalHistory', 'allergies', 'medications', 'status', 'notes',
    ];

    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return next(new AppError('No patient found with that ID.', 404));

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) patient[field] = req.body[field];
    });
    await patient.save();

    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const admin = await Admin.findByPk(req.admin.id);
    if (!admin) return next(new AppError('Admin not found.', 404));
    
    if (currentPassword) {
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) return next(new AppError('Current password is incorrect.', 401));
    }
    
    if (name) admin.name = name;
    if (email) admin.email = email;
    if (newPassword) admin.password = newPassword;
    
    await admin.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return next(new AppError('No service found with that ID.', 404));
    Object.assign(service, req.body);
    await service.save();
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
};

exports.updatePatientProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progressNotes, medicalProgress } = req.body;
    const patient = await Patient.findByPk(id);
    if (!patient) return next(new AppError('Patient not found.', 404));

    if (progressNotes !== undefined) patient.progressNotes = progressNotes;
    if (medicalProgress !== undefined) patient.medicalProgress = medicalProgress;

    await patient.save();

    res.json({
      success: true,
      message: 'Patient progress updated successfully.',
      data: {
        id: patient.id,
        progressNotes: patient.progressNotes,
        medicalProgress: patient.medicalProgress,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.addPatientReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeframe, followUpDate, message } = req.body;
    const patient = await Patient.findByPk(id);
    if (!patient) return next(new AppError('Patient not found.', 404));

    const reminder = {
      id: 'rem_' + Date.now(),
      timeframe: timeframe || '1 week',
      followUpDate: followUpDate || null,
      message: message || 'Follow-up visit requested by provider.',
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    const currentReminders = patient.reminders || [];
    const updatedReminders = [reminder, ...currentReminders];
    patient.reminders = updatedReminders;
    await patient.save();

    try {
      await sendFollowUpReminderEmail(patient, reminder);
    } catch (emailErr) {
      console.error('Follow-up reminder email failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Follow-up reminder sent and saved to patient account.',
      reminders: patient.reminders,
    });
  } catch (err) {
    next(err);
  }
};


