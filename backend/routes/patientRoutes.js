const express = require('express');
const router = express.Router();
const {
  registerPatient,
  loginPatient,
  getMe,
  updateMe,
  getMyAppointments,
  getMyProgress,
  logoutPatient,
  getSession,
  forgotPassword,
  resetPassword,
} = require('../controllers/patientController');
const { protectPatient, optionalPatientAuth } = require('../middleware/patientAuth');
const { authLimiter, adminWriteLimiter } = require('../middleware/security');

router.post('/register', authLimiter, registerPatient);
router.post('/login', authLimiter, loginPatient);
router.post('/logout', logoutPatient);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Session check (no auth required — returns patient if cookie is valid, null otherwise)
router.get('/session', optionalPatientAuth, getSession);

// Protected routes (Require Patient Authentication)
router.get('/me', protectPatient, getMe);
router.put('/me', protectPatient, adminWriteLimiter, updateMe);
router.get('/appointments', protectPatient, getMyAppointments);
router.get('/progress', protectPatient, getMyProgress);

module.exports = router;
