const express = require('express');
const router = express.Router();
const {
  login,
  getAppointments,
  getAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  exportAppointments,
  getStats,
  getPatients,
  getPatient,
  updatePatient,
  getServices,
  createService,
  updateService,
  updateProfile,
  getMe,
  updatePatientProgress,
  addPatientReminder,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authLimiter, adminWriteLimiter } = require('../middleware/security');

router.post('/login', authLimiter, login);
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', signed: true });
  res.json({ success: true, message: 'Logged out.' });
});

router.use(protect);

router.get('/me', getMe);
router.get('/stats', getStats);

router.get('/export', exportAppointments);
router.get('/appointments', getAppointments);
router.get('/appointments/:id', getAppointment);
router.put('/appointments/:id', adminWriteLimiter, updateAppointmentStatus);
router.delete('/appointments/:id', adminWriteLimiter, deleteAppointment);

router.get('/patients', getPatients);
router.get('/patients/:id', getPatient);
router.put('/patients/:id', adminWriteLimiter, updatePatient);
router.put('/patients/:id/progress', adminWriteLimiter, updatePatientProgress);
router.post('/patients/:id/reminders', adminWriteLimiter, addPatientReminder);

router.get('/services', getServices);
router.post('/services', adminWriteLimiter, createService);
router.put('/services/:id', adminWriteLimiter, updateService);
router.put('/profile', adminWriteLimiter, updateProfile);

module.exports = router;

