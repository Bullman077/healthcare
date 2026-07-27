const { Appointment, Service, Patient } = require('../models');
const { sendPaymentConfirmation } = require('../utils/email');
const { AppError } = require('../middleware/errorHandler');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { referenceNumber } = req.body;
    if (!referenceNumber) {
      return next(new AppError('Reference number is required.', 400));
    }

    const appointment = await Appointment.findOne({
      where: { referenceNumber },
      include: [
        { model: Patient, as: 'patient' },
        { model: Service, as: 'service' },
      ],
    });

    if (!appointment) {
      return next(new AppError('Appointment not found.', 404));
    }

    const service = appointment.service || {};
    const amount = (service.price || 50) * 100;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

    if (stripe && process.env.STRIPE_SECRET_KEY) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: service.name || 'Healthcare Visit',
              description: `Appointment ${referenceNumber}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${frontendUrl}/patient/?payment=success&ref=${referenceNumber}`,
        cancel_url: `${frontendUrl}/patient/?payment=cancelled&ref=${referenceNumber}`,
        metadata: { referenceNumber },
      });

      return res.json({
        success: true,
        message: 'Checkout session created.',
        data: {
          sessionId: session.id,
          checkoutUrl: session.url,
          amount,
          currency: 'usd',
          referenceNumber,
        },
      });
    }

    // Mock mode for development
    const sessionData = {
      sessionId: 'cs_test_' + Math.random().toString(36).substring(2),
      checkoutUrl: `${frontendUrl}/patient/?payment=mock&ref=${referenceNumber}`,
      amount,
      currency: 'usd',
      referenceNumber,
    };

    res.json({
      success: true,
      message: 'Checkout session created (development mode).',
      data: sessionData,
    });
  } catch (err) {
    next(err);
  }
};

exports.handleStripeWebhook = async (req, res, next) => {
  try {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET not configured.');
      return res.status(500).json({ error: 'Webhook not configured.' });
    }

    if (!req.headers['stripe-signature']) {
      return res.status(400).json({ error: 'Missing stripe-signature header.' });
    }

    const sig = req.headers['stripe-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const referenceNumber = session.metadata?.referenceNumber || session.referenceNumber;

      if (referenceNumber) {
        const appointment = await Appointment.findOne({
          where: { referenceNumber },
          include: [
            { model: Patient, as: 'patient' },
            { model: Service, as: 'service' },
          ],
        });

        if (appointment) {
          appointment.paid = true;
          await appointment.save();

          try {
            await sendPaymentConfirmation({
              patientEmail: appointment.patient?.email,
              patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
              doctorEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@uhshealthcare.com',
              referenceNumber: appointment.referenceNumber,
              amount: session.amount_total || (appointment.service?.price || 50) * 100,
              currency: session.currency || 'usd',
              serviceName: appointment.service?.name || 'Healthcare Visit',
            });
          } catch (emailErr) {
            console.warn('Payment receipt email notification error:', emailErr.message);
          }
        }
      }
    }

    res.json({ received: true, success: true });
  } catch (err) {
    next(err);
  }
};
