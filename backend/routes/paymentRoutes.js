const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleStripeWebhook } = require('../controllers/paymentController');
const { protectPatient } = require('../middleware/patientAuth');
const { apiLimiter } = require('../middleware/security');

router.post('/create-checkout', apiLimiter, protectPatient, createCheckoutSession);
router.post('/webhook', handleStripeWebhook);

module.exports = router;
