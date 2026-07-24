const express = require('express');
const router = express.Router();
const {
  submitMessage,
  getTestimonials,
  getPublicServices,
  getAboutContent,
} = require('../controllers/contentController');

/* ----- Public ----- */
router.post('/messages', submitMessage);
router.get('/testimonials', getTestimonials);
router.get('/services', getPublicServices);
router.get('/about-content', getAboutContent);

module.exports = router;
