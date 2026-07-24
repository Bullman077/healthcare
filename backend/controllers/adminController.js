const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op, fn, col, literal } = require('sequelize');
const { Admin, Patient, Appointment, Service, AuditLog, Message } = require('../models');
const { sequelize } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { sendStatusUpdate, sendFollowUpReminderEmail } = require('../utils/email');

const iLike = sequelize.dialect.name === 'sqlite' ? Op.like : Op.iLike;

const uploadsDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `admin-${req.admin.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname)) && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files (JPG, PNG, GIF, WebP) are allowed.', 400));
    }
  },
});

async function logAudit(admin, action, resource, resourceId, details, req) {
  try {
    await AuditLog.create({
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      resource,
      resourceId,
      details: details || {},
      ipAddress: req ? (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() : null,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}
exports.logAudit = logAudit;

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

const failedAttemptsMap = new Map();

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password.', 400));
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${email.toLowerCase()}_${ip}`;

    // Check lockout status
    const record = failedAttemptsMap.get(key);
    if (record && record.lockUntil) {
      if (Date.now() < record.lockUntil) {
        const minsLeft = Math.ceil((record.lockUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Account temporarily locked due to 3 failed login attempts. Please wait ${minsLeft} minute(s) before trying again.`,
        });
      } else {
        failedAttemptsMap.delete(key);
      }
    }

    const admin = await Admin.findOne({ where: { email, isActive: true } });
    if (!admin || !(await admin.comparePassword(password))) {
      const current = failedAttemptsMap.get(key) || { count: 0 };
      current.count += 1;
      current.lastAttempt = Date.now();
      
      if (current.count >= 3) {
        current.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
        failedAttemptsMap.set(key, current);
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Your access is locked for 15 minutes.',
        });
      } else {
        failedAttemptsMap.set(key, current);
        const remaining = 3 - current.count;
        return res.status(401).json({
          success: false,
          message: `Invalid email or password. You have ${remaining} attempt(s) remaining before a 15-minute lockout.`,
        });
      }
    }

    // Success -> Clear failed attempts counter
    failedAttemptsMap.delete(key);

    admin.lastLogin = new Date();
    admin.lastLoginIp = ip;
    await admin.save({ fields: ['lastLogin', 'lastLoginIp'] });

    const token = signToken(admin.id);

    await logAudit(admin, 'login', 'auth', admin.id, { email: admin.email, method: 'password' }, req);

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
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        profilePhoto: admin.profilePhoto,
        lastLogin: admin.lastLogin,
        lastLoginIp: admin.lastLoginIp,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  const admin = req.admin;
  res.json({
    success: true,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      profilePhoto: admin.profilePhoto,
      lastLogin: admin.lastLogin,
      lastLoginIp: admin.lastLoginIp,
      createdAt: admin.createdAt,
    },
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
        { referenceNumber: { [iLike]: term } },
        { '$patient.firstName$': { [iLike]: term } },
        { '$patient.lastName$': { [iLike]: term } },
        { '$patient.email$': { [iLike]: term } },
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
      appointments: rows,
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

    const previousStatus = appointment.status;
    appointment.status = status;
    if (status === 'cancelled') {
      appointment.cancelledAt = new Date();
      if (cancellationReason) appointment.cancellationReason = cancellationReason;
    }
    if (status === 'confirmed') {
      appointment.confirmedAt = new Date();
    }
    await appointment.save();

    await logAudit(req.admin, 'update_status', 'appointment', req.params.id, { status, previousStatus }, req);

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
    const refNumber = appointment.referenceNumber;
    await appointment.destroy();
    await logAudit(req.admin, 'delete', 'appointment', req.params.id, { referenceNumber: refNumber }, req);
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

let statsCache = { data: null, expiresAt: 0 };

// Reset the cached statistics to force fresh calculation on next request
function resetStatsCache() {
  statsCache = { data: null, expiresAt: 0 };
}

module.exports.resetStatsCache = resetStatsCache;

exports.getStats = async (req, res, next) => {
  try {
    if (statsCache.data && Date.now() < statsCache.expiresAt) {
      return res.json(statsCache.data);
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [totalPatients, totalAppointments, statusCounts, todayCount, unreadMessages, totalServices] = await Promise.all([
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
      Message.count({ where: { isRead: false } }),
      Service.count({ where: { isActive: true } }),
    ]);

    const statusMap = { confirmed: 0, cancelled: 0, completed: 0, 'no-show': 0 };
    statusCounts.forEach((s) => { statusMap[s.status] = parseInt(s.count, 10); });

    const responseData = {
      success: true,
      stats: {
        total: totalAppointments, totalPatients,
        confirmed: statusMap.confirmed, cancelled: statusMap.cancelled,
        completed: statusMap.completed, noShow: statusMap['no-show'],
        today: todayCount, unreadMessages, totalServices,
      },
    };

    statsCache = { data: responseData, expiresAt: Date.now() + 15000 };
    res.json(responseData);
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
        { firstName: { [iLike]: term } },
        { lastName: { [iLike]: term } },
        { email: { [iLike]: term } },
        { phone: { [iLike]: term } },
      ];
    }

    const { count, rows } = await Patient.findAndCountAll({
      where, order: [['createdAt', 'DESC']], offset, limit: parseInt(limit, 10), distinct: true,
      attributes: { exclude: ['resetPasswordToken', 'resetPasswordExpires'] },
    });

    res.json({
      success: true, patients: rows,
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
    const patient = await Patient.findByPk(req.params.id, {
      attributes: { exclude: ['resetPasswordToken', 'resetPasswordExpires', 'passwordHash'] },
    });
    if (!patient) return next(new AppError('No patient found with that ID.', 404));

    const appointments = await Appointment.findAll({
      where: { patientId: patient.id },
      include: [{ association: 'service', attributes: ['name'] }],
      order: [['date', 'DESC']],
      limit: 50,
    });

    res.json({ success: true, patient, appointments });
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
    await logAudit(req.admin, 'update', 'patient', req.params.id, { email: patient.email }, req);

    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

exports.getServices = async (req, res, next) => {
  try {
    const services = await Service.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });
    res.json({ success: true, services });
  } catch (err) {
    next(err);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'description', 'duration', 'price', 'category',
      'isActive', 'requiresPreparation', 'preparationInstructions',
      'color', 'icon',
    ];
    const filtered = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) filtered[field] = req.body[field];
    });
    const service = await Service.create(filtered);
    await logAudit(req.admin, 'create', 'service', service.id, { name: service.name }, req);
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

    const changes = {};
    if (name && name !== admin.name) changes.name = { from: admin.name, to: name };
    if (email && email !== admin.email) changes.email = { from: admin.email, to: email };
    if (newPassword) changes.password = { changed: true };
    
    if (newPassword) {
      if (!currentPassword) {
        return next(new AppError('Current password is required to set a new password.', 400));
      }
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) return next(new AppError('Current password is incorrect.', 401));
      admin.password = newPassword;
    }
    
    if (name) admin.name = name;
    if (email) admin.email = email;
    
    await admin.save();
    
    if (Object.keys(changes).length > 0) {
      await logAudit(req.admin, 'update_profile', 'profile', admin.id, changes, req);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
        profilePhoto: admin.profilePhoto,
        lastLogin: admin.lastLogin,
        lastLoginIp: admin.lastLoginIp,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'description', 'duration', 'price', 'category',
      'isActive', 'requiresPreparation', 'preparationInstructions',
      'color', 'icon',
    ];
    const service = await Service.findByPk(req.params.id);
    if (!service) return next(new AppError('No service found with that ID.', 404));
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) service[field] = req.body[field];
    });
    await service.save();
    await logAudit(req.admin, 'update', 'service', req.params.id, { name: service.name }, req);
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

    await logAudit(req.admin, 'update_notes', 'patient', patient.id, {
      patientEmail: patient.email,
      fieldsUpdated: Object.keys(req.body).filter(k => req.body[k] !== undefined),
    }, req);

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

    await logAudit(req.admin, 'create', 'reminder', patient.id, {
      patientEmail: patient.email,
      timeframe: reminder.timeframe,
      followUpDate: reminder.followUpDate,
    }, req);

    res.json({
      success: true,
      message: 'Follow-up reminder sent and saved to patient account.',
      reminders: patient.reminders,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, dateFrom, dateTo, action, resource } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = to;
      }
    }
    if (action) where.action = action;
    if (resource) where.resource = resource;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit, 10),
    });

    res.json({
      success: true,
      logs: rows,
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

/* ===== APPOINTMENT NOTES ===== */
exports.updateAppointmentNotes = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email'] },
        { association: 'service', attributes: ['name'] },
      ],
    });
    if (!appointment) return next(new AppError('No appointment found with that ID.', 404));

    appointment.notes = notes;
    await appointment.save({ fields: ['notes'] });
    await logAudit(req.admin, 'update_notes', 'appointment', req.params.id, { notes: (notes || '').substring(0, 100) }, req);

    res.json({ success: true, message: 'Notes saved.', data: appointment });
  } catch (err) {
    next(err);
  }
};

/* ===== SERVICE DELETE ===== */
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return next(new AppError('No service found with that ID.', 404));

    const apptCount = await Appointment.count({ where: { serviceId: service.id } });
    if (apptCount > 0) {
      service.isActive = false;
      await service.save({ fields: ['isActive'] });
      await logAudit(req.admin, 'deactivate', 'service', req.params.id, { name: service.name, reason: 'has appointments' }, req);
      return res.json({ success: true, message: 'Service deactivated (has existing appointments).', data: service });
    }

    await service.destroy();
    await logAudit(req.admin, 'delete', 'service', req.params.id, { name: service.name }, req);
    res.json({ success: true, message: 'Service deleted permanently.' });
  } catch (err) {
    next(err);
  }
};

/* ===== TODAY'S SCHEDULE ===== */
exports.getTodaySchedule = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.findAll({
      where: {
        date: { [Op.gte]: today, [Op.lt]: tomorrow },
        status: { [Op.in]: ['confirmed', 'completed'] },
      },
      include: [
        { association: 'patient', attributes: ['firstName', 'lastName', 'email', 'phone'] },
        { association: 'service', attributes: ['name', 'duration', 'color', 'category'] },
      ],
      order: [['time', 'ASC']],
    });

    res.json({ success: true, appointments });
  } catch (err) {
    next(err);
  }
};

/* ===== APPOINTMENT TRENDS (last 7 days) ===== */
exports.getAppointmentTrends = async (req, res, next) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const [confirmed, completed, cancelled] = await Promise.all([
        Appointment.count({ where: { date: { [Op.gte]: d, [Op.lt]: next }, status: 'confirmed' } }),
        Appointment.count({ where: { date: { [Op.gte]: d, [Op.lt]: next }, status: 'completed' } }),
        Appointment.count({ where: { date: { [Op.gte]: d, [Op.lt]: next }, status: { [Op.in]: ['cancelled', 'no-show'] } } }),
      ]);

      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        confirmed, completed, cancelled,
        total: confirmed + completed + cancelled,
      });
    }

    res.json({ success: true, data: days });
  } catch (err) {
    next(err);
  }
};

/* ===== SERVICE DISTRIBUTION ===== */
exports.getServiceDistribution = async (req, res, next) => {
  try {
    const distributions = await Appointment.findAll({
      attributes: ['serviceId', [fn('COUNT', col('Appointment.id')), 'count']],
      include: [{ association: 'service', attributes: ['name', 'color'] }],
      group: ['serviceId', 'service.id', 'service.name', 'service.color'],
      order: [[fn('COUNT', col('Appointment.id')), 'DESC']],
      raw: true,
      nest: true,
    });

    res.json({ success: true, data: distributions });
  } catch (err) {
    next(err);
  }
};

/* ===== NEW PATIENTS THIS MONTH ===== */
exports.getNewPatientsThisMonth = async (req, res, next) => {
  try {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const count = await Patient.count({
      where: { createdAt: { [Op.gte]: start } },
    });

    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
};

/* ===== PROFILE PHOTO UPLOAD ===== */
exports.uploadProfilePhoto = [
  upload.single('photo'),
  async (req, res, next) => {
    try {
      if (!req.file) return next(new AppError('Please upload an image file.', 400));

      const admin = await Admin.findByPk(req.admin.id);
      if (!admin) return next(new AppError('Admin not found.', 404));

      if (admin.profilePhoto) {
        const oldPath = path.join(__dirname, '..', admin.profilePhoto);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      admin.profilePhoto = `/uploads/profiles/${req.file.filename}`;
      await admin.save({ fields: ['profilePhoto'] });

      await logAudit(req.admin, 'upload_photo', 'profile', admin.id, { filename: req.file.filename }, req);

      res.json({
        success: true,
        message: 'Profile photo updated.',
        profilePhoto: admin.profilePhoto,
      });
    } catch (err) {
      next(err);
    }
  },
];


