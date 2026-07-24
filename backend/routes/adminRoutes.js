const express = require('express');
const router = express.Router();
const {
  login,
  getAppointments,
  getAppointment,
  updateAppointmentStatus,
  updateAppointmentNotes,
  deleteAppointment,
  exportAppointments,
  getStats,
  getTodaySchedule,
  getAppointmentTrends,
  getServiceDistribution,
  getPatients,
  getPatient,
  updatePatient,
  getServices,
  createService,
  updateService,
  deleteService,
  updateProfile,
  getMe,
  updatePatientProgress,
  addPatientReminder,
  getAuditLogs,
  getNewPatientsThisMonth,
  uploadProfilePhoto,
} = require('../controllers/adminController');
const {
  getMessages, getMessage, toggleMessageRead, deleteMessage,
  getAllTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
  getSettings, updateSettings,
} = require('../controllers/contentController');
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
router.get('/today-schedule', getTodaySchedule);
router.get('/appointment-trends', getAppointmentTrends);
router.get('/service-distribution', getServiceDistribution);
router.get('/new-patients-this-month', getNewPatientsThisMonth);

router.get('/export', exportAppointments);
router.get('/appointments', getAppointments);
router.get('/appointments/:id', getAppointment);
router.put('/appointments/:id', adminWriteLimiter, updateAppointmentStatus);
router.put('/appointments/:id/notes', adminWriteLimiter, updateAppointmentNotes);
router.delete('/appointments/:id', adminWriteLimiter, deleteAppointment);

router.get('/patients', getPatients);
router.get('/patients/:id', getPatient);
router.put('/patients/:id', adminWriteLimiter, updatePatient);
router.put('/patients/:id/progress', adminWriteLimiter, updatePatientProgress);
router.post('/patients/:id/reminders', adminWriteLimiter, addPatientReminder);

router.get('/services', getServices);
router.post('/services', adminWriteLimiter, createService);
router.put('/services/:id', adminWriteLimiter, updateService);
router.delete('/services/:id', adminWriteLimiter, deleteService);
router.put('/profile', adminWriteLimiter, updateProfile);
router.post('/profile/photo', adminWriteLimiter, uploadProfilePhoto);
router.get('/audit-logs', getAuditLogs);

router.get('/messages', getMessages);
router.get('/messages/:id', getMessage);
router.put('/messages/:id/read', toggleMessageRead);
router.delete('/messages/:id', adminWriteLimiter, deleteMessage);

router.get('/testimonials/manage', getAllTestimonials);
router.post('/testimonials/manage', adminWriteLimiter, createTestimonial);
router.put('/testimonials/manage/:id', adminWriteLimiter, updateTestimonial);
router.delete('/testimonials/manage/:id', adminWriteLimiter, deleteTestimonial);

router.get('/settings', getSettings);
router.put('/settings', adminWriteLimiter, updateSettings);

module.exports = router;

