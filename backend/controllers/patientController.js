const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Patient, Appointment, Service } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { sendPasswordResetEmail } = require('../utils/email');

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

function generateToken(id) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not configured.');
  }
  return jwt.sign({ id, role: 'patient' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sendPatientToken(patient, statusCode, res) {
  const token = generateToken(patient.id);
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax',
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('patientToken', token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    token,
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
    },
  });
}

exports.registerPatient = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return next(new AppError('Please fill in all required fields.', 400));
    }

    const passwordError = validatePassword(password);
    if (passwordError) return next(new AppError(passwordError, 400));

    let patient = await Patient.findOne({ where: { email: email.toLowerCase() } });
    if (patient) {
      if (patient.passwordHash) {
        return next(new AppError('An account with this email already exists. Please sign in.', 400));
      }
      // Link existing booking record to new portal account
      patient.firstName = firstName;
      patient.lastName = lastName;
      patient.phone = phone || patient.phone;
      await patient.setPassword(password);
      await patient.save();
    } else {
      patient = Patient.build({
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || '',
      });
      await patient.setPassword(password);
      await patient.save();
    }

    sendPatientToken(patient, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.loginPatient = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please enter your email and password.', 400));
    }

    const patient = await Patient.findOne({ where: { email: email.toLowerCase() } });
    if (!patient || !(await patient.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    sendPatientToken(patient, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    patient: {
      id: req.patient.id,
      firstName: req.patient.firstName,
      lastName: req.patient.lastName,
      email: req.patient.email,
      phone: req.patient.phone,
      dateOfBirth: req.patient.dateOfBirth,
      address: req.patient.address,
      insurance: req.patient.insurance,
      allergies: req.patient.allergies,
      medications: req.patient.medications,
      reminders: req.patient.reminders || [],
    },
  });
};

exports.getMyAppointments = async (req, res, next) => {
  try {
    // STRICT ROW-LEVEL PRIVACY: Filter ONLY by req.patient.id
    const appointments = await Appointment.findAll({
      where: { patientId: req.patient.id },
      include: [{ model: Service, as: 'service', attributes: ['name', 'duration'] }],
      order: [['date', 'DESC'], ['time', 'ASC']],
    });

    res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (err) {
    next(err);
  }
};

exports.getSession = async (req, res) => {
  if (req.patient) {
    return res.json({
      success: true,
      patient: {
        id: req.patient.id,
        firstName: req.patient.firstName,
        lastName: req.patient.lastName,
        email: req.patient.email,
        phone: req.patient.phone,
      },
    });
  }
  res.json({ success: false, patient: null });
};

exports.getMyProgress = async (req, res, next) => {
  try {
    // STRICT ROW-LEVEL PRIVACY: Patient sees ONLY their own progress notes & reminders
    res.json({
      success: true,
      patientName: `${req.patient.firstName} ${req.patient.lastName}`,
      progressNotes: req.patient.progressNotes || 'No specific progress notes recorded yet.',
      medicalProgress: req.patient.medicalProgress || [],
      reminders: req.patient.reminders || [],
    });
  } catch (err) {
    next(err);
  }
};

exports.logoutPatient = async (req, res) => {
  res.cookie('patientToken', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
};

exports.updateMe = async (req, res, next) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'dateOfBirth',
      'address', 'insurance', 'emergencyContact',
      'allergies', 'medications',
    ];
    const patient = await Patient.findByPk(req.patient.id);
    if (!patient) return next(new AppError('Patient not found.', 404));

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) patient[field] = req.body[field];
    });
    await patient.save();

    res.json({
      success: true,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        address: patient.address,
        insurance: patient.insurance,
        emergencyContact: patient.emergencyContact,
        allergies: patient.allergies,
        medications: patient.medications,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Please provide your email address.', 400));

    const patient = await Patient.findOne({ where: { email: email.toLowerCase() } });
    if (!patient) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    patient.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    patient.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await patient.save({ fields: ['resetPasswordToken', 'resetPasswordExpires'] });

    try {
      await sendPasswordResetEmail(patient, resetToken);
    } catch (emailErr) {
      console.error('Password reset email failed:', emailErr.message);
    }

    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return next(new AppError('Token and new password are required.', 400));

    const passwordError = validatePassword(password);
    if (passwordError) return next(new AppError(passwordError, 400));

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const patient = await Patient.findOne({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    if (!patient || !patient.resetPasswordExpires || patient.resetPasswordExpires < new Date()) {
      return next(new AppError('Invalid or expired reset token.', 400));
    }

    await patient.setPassword(password);
    patient.resetPasswordToken = null;
    patient.resetPasswordExpires = null;
    await patient.save();

    sendPatientToken(patient, 200, res);
  } catch (err) {
    next(err);
  }
};
