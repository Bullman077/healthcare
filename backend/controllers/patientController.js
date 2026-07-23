const jwt = require('jsonwebtoken');
const { Patient, Appointment, Service } = require('../models');
const { AppError } = require('../middleware/errorHandler');

function generateToken(id) {
  return jwt.sign({ id, role: 'patient' }, process.env.JWT_SECRET || 'uhs_jwt_secret', {
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
