const jwt = require('jsonwebtoken');
const { Patient } = require('../models');
const { AppError } = require('./errorHandler');

exports.optionalPatientAuth = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.patientToken) {
    token = req.cookies.patientToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uhs_jwt_secret');
    const patient = await Patient.findByPk(decoded.id);
    if (patient && patient.status !== 'archived') {
      req.patient = patient;
    }
  } catch (_) { /* ignore invalid token */ }
  next();
};

exports.protectPatient = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.patientToken) {
    token = req.cookies.patientToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Please sign in to access your patient portal.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uhs_jwt_secret');
    const patient = await Patient.findByPk(decoded.id);

    if (!patient || patient.status === 'archived') {
      return next(new AppError('Patient account not found or deactivated.', 401));
    }

    req.patient = patient;
    next();
  } catch (err) {
    return next(new AppError('Session expired. Please sign in again.', 401));
  }
};
