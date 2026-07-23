const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleStripeWebhook } = require('../controllers/paymentController');

router.post('/create-checkout', createCheckoutSession);
router.post('/webhook', handleStripeWebhook);

module.exports = router;
