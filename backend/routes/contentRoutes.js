const express = require('express');
const router = express.Router();
const {
  submitMessage,
  getTestimonials,
  getPublicServices,
} = require('../controllers/contentController');

/* ----- Public ----- */
router.post('/messages', submitMessage);
router.get('/testimonials', getTestimonials);
router.get('/services', getPublicServices);

module.exports = router;
