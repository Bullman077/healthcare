const express = require('express');
const router = express.Router();
const {
  submitMessage, getMessages, getMessage, deleteMessage,
  getTestimonials, getAllTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
  getSettings, updateSettings, getPublicServices,
} = require('../controllers/contentController');
const { protect } = require('../middleware/auth');
const { adminWriteLimiter } = require('../middleware/security');

/* ----- Public ----- */
router.post('/messages', submitMessage);
router.get('/testimonials', getTestimonials);
router.get('/services', getPublicServices);

/* ----- Protected (admin) ----- */
router.use('/messages', protect);
router.get('/messages', getMessages);
router.get('/messages/:id', getMessage);
router.delete('/messages/:id', adminWriteLimiter, deleteMessage);

router.use('/testimonials/manage', protect);
router.get('/testimonials/manage', getAllTestimonials);
router.post('/testimonials/manage', adminWriteLimiter, createTestimonial);
router.put('/testimonials/manage/:id', adminWriteLimiter, updateTestimonial);
router.delete('/testimonials/manage/:id', adminWriteLimiter, deleteTestimonial);

router.use('/settings', protect);
router.get('/settings', getSettings);
router.put('/settings', adminWriteLimiter, updateSettings);

module.exports = router;
