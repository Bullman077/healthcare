const cron = require('node-cron');
const { Op } = require('sequelize');
const { Appointment, Patient, Service } = require('./models');
const { sendReminderEmail } = require('./utils/email');

const REMINDER_HOURS_BEFORE = 24;

async function sendAppointmentReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayStr = new Date().toISOString().split('T')[0];

    const appointments = await Appointment.findAll({
      where: {
        date: { [Op.between]: [todayStr, tomorrowStr] },
        status: 'confirmed',
      },
      include: [
        { model: Patient, as: 'patient' },
        { model: Service, as: 'service' },
      ],
    });

    let sentCount = 0;
    for (const appt of appointments) {
      const remindersSent = appt.remindersSent || [];
      if (remindersSent.includes('24h_reminder')) continue;

      try {
        await sendReminderEmail({
          ...appt.toJSON(),
          patient: appt.patient,
          service: appt.service,
        });

        remindersSent.push('24h_reminder');
        await appt.update({ remindersSent });
        sentCount++;
      } catch (err) {
        console.error(`Failed to send reminder for ${appt.referenceNumber}:`, err.message);
      }
    }

    if (sentCount > 0) {
      console.log(`[SCHEDULER] Sent ${sentCount} appointment reminder(s).`);
    }
  } catch (err) {
    console.error('[SCHEDULER] Reminder job error:', err.message);
  }
}

function startScheduler() {
  cron.schedule('0 8 * * *', sendAppointmentReminders, {
    timezone: 'America/New_York',
  });
  console.log('[SCHEDULER] Appointment reminder cron scheduled (daily at 8:00 AM ET).');
}

module.exports = { startScheduler, sendAppointmentReminders };
