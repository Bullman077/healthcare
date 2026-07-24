const express = require('express');
const router = express.Router();
const {
  submitMessage,
  getTestimonials,
  getPublicServices,
  getSiteContent,
} = require('../controllers/contentController');

/* ----- Public ----- */
router.post('/messages', submitMessage);
router.get('/testimonials', getTestimonials);
router.get('/services', getPublicServices);
router.get('/site-content', getSiteContent);
router.get('/about-content', getSiteContent);

module.exports = router;
