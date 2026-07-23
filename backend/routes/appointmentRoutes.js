const express = require('express');
const router = express.Router();
const { createAppointment, getAppointmentByRef, getAppointmentsByEmail } = require('../controllers/appointmentController');
const { appointmentRules, validate } = require('../middleware/validateAppointment');
const { apiLimiter } = require('../middleware/security');
const { optionalPatientAuth } = require('../middleware/patientAuth');

router.post('/', optionalPatientAuth, apiLimiter, appointmentRules, validate, createAppointment);
router.get('/by-email', apiLimiter, getAppointmentsByEmail);
router.get('/:ref', getAppointmentByRef);

module.exports = router;
