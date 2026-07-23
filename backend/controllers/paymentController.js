const { Appointment, Service, Patient } = require('../models');
const { sendPaymentConfirmation } = require('../utils/email');
const { AppError } = require('../middleware/errorHandler');

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
    const amount = (service.price || 50) * 100; // in cents (USD)

    // Stripe checkout session format (mock / production ready)
    const sessionData = {
      sessionId: 'cs_test_' + Math.random().toString(36).substring(2),
      checkoutUrl: `https://checkout.stripe.com/pay/${appointment.referenceNumber}`,
      amount,
      currency: 'usd',
      referenceNumber: appointment.referenceNumber,
    };

    res.json({
      success: true,
      message: 'Checkout session created.',
      data: sessionData,
    });
  } catch (err) {
    next(err);
  }
};

exports.handleStripeWebhook = async (req, res, next) => {
  try {
    const { referenceNumber, amount, currency } = req.body;

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

      // Trigger Dual Confirmation Receipt (Doctor & Patient)
      try {
        await sendPaymentConfirmation({
          patientEmail: appointment.patient?.email,
          patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
          doctorEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@uhshealthcare.com',
          referenceNumber: appointment.referenceNumber,
          amount: amount || 7500,
          currency: currency || 'usd',
          serviceName: appointment.service?.name || 'Healthcare Visit',
        });
      } catch (emailErr) {
        console.warn('Payment receipt email notification error:', emailErr.message);
      }
    }

    res.json({ received: true, success: true });
  } catch (err) {
    next(err);
  }
};
