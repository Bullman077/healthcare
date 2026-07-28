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

function generateToken(id, tokenVersion) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not configured.');
  }
  return jwt.sign({ id, role: 'patient', tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

async function sendPatientToken(patient, statusCode, res) {
  const token = generateToken(patient.id, patient.tokenVersion || 0);
  const refreshToken = generateRefreshToken();
  
  patient.refreshToken = refreshToken;
  await patient.save({ fields: ['refreshToken'] });

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    maxAge: 15 * 60 * 1000, // 15 minutes
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  };
  const refreshCookieOptions = {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  };

  res.cookie('patientToken', token, cookieOptions);
  res.cookie('patientRefreshToken', refreshToken, refreshCookieOptions);

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
        return next(new AppError('Please sign in to your existing account, or use a different email to register.', 400));
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

    await sendPatientToken(patient, 201, res);
  } catch (err) {
    next(err);
  }
};

const MAX_PATIENT_LOGIN_ATTEMPTS = 3;
const PATIENT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

exports.loginPatient = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please enter your email and password.', 400));
    }

    const patient = await Patient.findOne({ where: { email: email.toLowerCase() } });

    // Brute-force lockout check (before password verification to prevent timing bypass)
    if (patient && patient.loginLockedUntil && patient.loginLockedUntil > new Date()) {
      const minsLeft = Math.ceil((patient.loginLockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to ${MAX_PATIENT_LOGIN_ATTEMPTS} failed login attempts. Please wait ${minsLeft} minute(s) before trying again.`,
      });
    }

    const passwordValid = patient && (await patient.comparePassword(password));

    if (!patient || !passwordValid) {
      // Increment failed attempt counter on the DB record
      if (patient) {
        const attempts = (patient.loginAttempts || 0) + 1;
        const updates = { loginAttempts: attempts };
        if (attempts >= MAX_PATIENT_LOGIN_ATTEMPTS) {
          updates.loginLockedUntil = new Date(Date.now() + PATIENT_LOCKOUT_DURATION_MS);
          await patient.update(updates, { fields: ['loginAttempts', 'loginLockedUntil'] });
          return res.status(429).json({
            success: false,
            message: 'Too many failed login attempts. Your account is locked for 15 minutes.',
          });
        }
        await patient.update(updates, { fields: ['loginAttempts', 'loginLockedUntil'] });
        const remaining = MAX_PATIENT_LOGIN_ATTEMPTS - attempts;
        return res.status(401).json({
          success: false,
          message: `Invalid email or password. You have ${remaining} attempt(s) remaining before a 15-minute lockout.`,
        });
      }
      // Generic message when account doesn't exist (prevent email enumeration)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Success — reset failed attempts counter
    patient.loginAttempts = 0;
    patient.loginLockedUntil = null;
    await patient.save({ fields: ['loginAttempts', 'loginLockedUntil'] });

    await sendPatientToken(patient, 200, res);
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
  // Invalidate all outstanding tokens
  if (req.patient) {
    await req.patient.update({ tokenVersion: (req.patient.tokenVersion || 0) + 1 });
  }
  const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.cookie('patientToken', 'none', { ...cookieOptions, maxAge: 5 * 1000 });
  res.cookie('patientRefreshToken', 'none', { ...cookieOptions, maxAge: 5 * 1000 });
  res.json({ success: true, message: 'Logged out successfully.' });
};

exports.updateMe = async (req, res, next) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'dateOfBirth',
      'address', 'insurance', 'emergencyContact',
      'allergies', 'medications',
    ];

    // String field length limits to prevent oversized payloads
    const STRING_LIMITS = {
      firstName: 50,
      lastName: 50,
      phone: 20,
    };

    const patient = await Patient.findByPk(req.patient.id);
    if (!patient) return next(new AppError('Patient not found.', 404));

    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) return;

      let value = req.body[field];

      // Trim and enforce max length on string fields
      if (typeof value === 'string') {
        value = value.trim();
        const limit = STRING_LIMITS[field];
        if (limit && value.length > limit) {
          return; // silently ignore oversized values (validator will report if needed)
        }
      }

      patient[field] = value;
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

/* ===== REFRESH TOKEN ===== */
exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.patientRefreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided.' });
    }

    const patient = await Patient.findOne({ where: { refreshToken } });
    if (!patient || patient.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    // Rotate refresh token (invalidate old one)
    const newRefreshToken = generateRefreshToken();
    patient.refreshToken = newRefreshToken;
    await patient.save({ fields: ['refreshToken'] });

    const newToken = generateToken(patient.id, patient.tokenVersion || 0);
    const cookieOptions = {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    const refreshCookieOptions = {
      maxAge: 8 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.cookie('patientToken', newToken, cookieOptions);
    res.cookie('patientRefreshToken', newRefreshToken, refreshCookieOptions);

    res.json({ success: true, token: newToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  // Invalidate all outstanding tokens if patient is authenticated
  if (req.patient) {
    await req.patient.update({ tokenVersion: (req.patient.tokenVersion || 0) + 1 });
  }
  const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.clearCookie('patientToken', cookieOptions);
  res.clearCookie('patientRefreshToken', cookieOptions);
  res.json({ success: true, message: 'Logged out successfully.' });
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
    // Invalidate all outstanding tokens
    patient.tokenVersion = (patient.tokenVersion || 0) + 1;
    await patient.save();

    await sendPatientToken(patient, 200, res);
  } catch (err) {
    next(err);
  }
};
