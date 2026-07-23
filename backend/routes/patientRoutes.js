const express = require('express');
const router = express.Router();
const {
  registerPatient,
  loginPatient,
  getMe,
  getMyAppointments,
  getMyProgress,
  logoutPatient,
  getSession,
} = require('../controllers/patientController');
const { protectPatient, optionalPatientAuth } = require('../middleware/patientAuth');

router.post('/register', registerPatient);
router.post('/login', loginPatient);
router.post('/logout', logoutPatient);

// Session check (no auth required — returns patient if cookie is valid, null otherwise)
router.get('/session', optionalPatientAuth, getSession);

// Protected routes (Require Patient Authentication)
router.get('/me', protectPatient, getMe);
router.get('/appointments', protectPatient, getMyAppointments);
router.get('/progress', protectPatient, getMyProgress);

module.exports = router;
