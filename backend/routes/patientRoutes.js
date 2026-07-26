const express = require('express');
const router = express.Router();
const {
  registerPatient,
  loginPatient,
  getMe,
  updateMe,
  getMyAppointments,
  getMyProgress,
  refresh,
  logout,
  getSession,
  forgotPassword,
  resetPassword,
} = require('../controllers/patientController');
const { protectPatient, optionalPatientAuth } = require('../middleware/patientAuth');
const { authLimiter, adminWriteLimiter, passwordResetLimiter, registerLimiter } = require('../middleware/security');

router.post('/register', registerLimiter, registerPatient);
router.post('/login', authLimiter, loginPatient);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// Session check (no auth required — returns patient if cookie is valid, null otherwise)
router.get('/session', optionalPatientAuth, getSession);

// Protected routes (Require Patient Authentication)
router.get('/me', protectPatient, getMe);
router.put('/me', protectPatient, adminWriteLimiter, updateMe);
router.get('/appointments', protectPatient, getMyAppointments);
router.get('/progress', protectPatient, getMyProgress);

module.exports = router;
