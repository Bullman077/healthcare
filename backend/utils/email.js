const nodemailer = require('nodemailer');

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function createTransporter() {
  const isPlaceholder = !process.env.EMAIL_USER || process.env.EMAIL_USER.includes('your_ethereal');

  if (process.env.NODE_ENV === 'production' && !isPlaceholder) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: parseInt(process.env.EMAIL_PORT, 10) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Development / fallback stream transporter (logs emails safely to console)
  return {
    sendMail: async (opts) => {
      console.log(`[EMAIL SIMULATOR] To: ${opts.to} | Subject: ${opts.subject}`);
      return { messageId: 'simulated_' + Date.now() };
    },
    close: () => {},
  };
}

let transporter;

function getTransporter() {
  if (!transporter) transporter = createTransporter();
  return transporter;
}

function extractAppointmentData(appointment) {
  const patient = appointment.patient || appointment.Patient || {};
  const service = appointment.service || appointment.Service || {};
  const patientName = patient.fullName || (patient.firstName && `${patient.firstName} ${patient.lastName}`) || 'Patient';
  const patientEmail = patient.email || '';
  const serviceName = service.name || 'Healthcare Visit';
  const isTelehealth = service.category === 'telehealth' || serviceName.toLowerCase().includes('telehealth') || serviceName.toLowerCase().includes('virtual');
  const dateStr = new Date(appointment.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Automated Google Meet video link generation
  const meetUrl = appointment.meetingUrl || `https://meet.google.com/uhs-${(appointment.referenceNumber || 'visit').toLowerCase()}`;

  return { patientName, patientEmail, serviceName, isTelehealth, dateStr, meetUrl };
}

async function sendConfirmation(appointment) {
  const { patientName, patientEmail, serviceName, isTelehealth, dateStr, meetUrl } = extractAppointmentData(appointment);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const { referenceNumber, time } = appointment;

  if (!patientEmail) {
    console.warn('No patient email found — skipping confirmation for', referenceNumber);
    return null;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#F8FAFC;color:#1E293B;}
    .container{max-width:620px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);border:1px solid #E2E8F0;}
    .header{background:linear-gradient(135deg,#0F766E,#0D9488);color:#FFFFFF;padding:36px 30px;text-align:center;}
    .header h1{margin:0;font-size:24px;font-weight:700;}
    .body{padding:32px 28px;}
    .ref-box{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;text-align:center;margin:20px 0;}
    .ref-code{font-size:26px;font-weight:800;color:#0F766E;letter-spacing:2px;font-family:monospace;}
    .details{width:100%;border-collapse:collapse;margin:20px 0;}
    .details td{padding:12px 0;border-bottom:1px solid #F1F5F9;}
    .details td:first-child{font-weight:600;color:#475569;width:130px;}
    .btn-video{display:inline-block;margin:20px 0 10px;padding:14px 28px;background:#0F766E;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(15,118,110,0.25);}
    .btn-portal{display:inline-block;margin-top:8px;padding:10px 20px;background:#F1F5F9;color:#0F766E;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;}
    .footer{text-align:center;padding:24px;background:#F8FAFC;color:#64748B;font-size:12px;border-top:1px solid #E2E8F0;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointment Confirmed</h1>
      <p style="margin:6px 0 0;opacity:0.92;font-size:14px;">UHS Healthcare Services &bull; Direct Primary Care</p>
    </div>
    <div class="body">
      <p>Dear <strong>${escHtml(patientName)}</strong>,</p>
      <p>Your appointment has been successfully scheduled. Below are your appointment details and reference number:</p>

      <div class="ref-box">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#166534;font-weight:700;margin-bottom:4px;">Booking Reference</div>
        <div class="ref-code">${escHtml(referenceNumber)}</div>
      </div>

      <table class="details">
        <tr><td>Service</td><td><strong>${escHtml(serviceName)}</strong></td></tr>
        <tr><td>Date</td><td>${escHtml(dateStr)}</td></tr>
        <tr><td>Time</td><td>${escHtml(time)}</td></tr>
        <tr><td>Provider</td><td>${escHtml(appointment.provider || 'Nacole Brown, MSN, AGPCNP-BC')}</td></tr>
        <tr><td>Type</td><td>${isTelehealth ? '📹 Telehealth (Virtual Visit)' : '🏥 In-Person Clinic Visit'}</td></tr>
      </table>

      ${isTelehealth ? `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <h3 style="margin:0 0 8px;color:#1E40AF;font-size:16px;">📹 Virtual Consultation Room</h3>
        <p style="margin:0 0 14px;font-size:13px;color:#3B82F6;">Click below to join your Google Meet video call at your scheduled time:</p>
        <a href="${meetUrl}" target="_blank" class="btn-video">Join Video Consultation</a>
        <div style="font-size:11px;color:#64748B;margin-top:10px;">Link: <a href="${meetUrl}" style="color:#2563EB;">${meetUrl}</a></div>
      </div>
      ` : `
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px;font-size:13px;color:#92400E;margin:20px 0;">
        <strong>🏥 Location Reminder:</strong> 2638 Two Notch Rd. Suite 210 Unit 10, Columbia, SC 29204.<br>Please arrive 10-15 minutes early with your photo ID.
      </div>
      `}

      <div style="text-align:center;margin-top:24px;">
        <a href="${frontendUrl}/patient/" class="btn-portal">🔐 Access Patient Portal & Health Records</a>
      </div>
    </div>
    <div class="footer">
      <p><strong>UHS Healthcare Services</strong> &bull; Columbia, SC &bull; (803) 381-7489</p>
      <p>Need to reschedule? Call us directly or update your booking in your Patient Portal.</p>
    </div>
  </div>
</body>
</html>`;

  const info = await getTransporter().sendMail({
    from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: patientEmail,
    subject: `✅ Appointment Confirmed – ${referenceNumber} (${serviceName})`,
    html,
  });

  if (process.env.NODE_ENV !== 'production') {
    const preview = info.messageId && !info.messageId.startsWith('simulated_')
      ? nodemailer.getTestMessageUrl(info)
      : `[simulated] ${info.messageId}`;
    console.log('Confirmation Email preview: %s', preview);
  }

  return info;
}

async function sendReminderEmail(appointment) {
  const { patientName, patientEmail, serviceName, isTelehealth, dateStr, meetUrl } = extractAppointmentData(appointment);
  const { referenceNumber, time } = appointment;

  if (!patientEmail) return null;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#F8FAFC;}
    .container{max-width:600px;margin:20px auto;background:#FFF;border-radius:12px;padding:30px;border:1px solid #E2E8F0;}
    .btn-video{display:inline-block;padding:12px 24px;background:#0F766E;color:#FFF;text-decoration:none;border-radius:8px;font-weight:bold;}
  </style>
</head>
<body>
  <div class="container">
    <h2 style="color:#0F766E;margin-top:0;">⏰ Appointment Reminder - UHS Healthcare</h2>
    <p>Dear ${escHtml(patientName)},</p>
    <p>This is a reminder for your upcoming appointment:</p>
    <ul style="line-height:1.8;">
      <li><strong>Service:</strong> ${escHtml(serviceName)}</li>
      <li><strong>Date:</strong> ${escHtml(dateStr)}</li>
      <li><strong>Time:</strong> ${escHtml(time)}</li>
      <li><strong>Reference:</strong> ${escHtml(referenceNumber)}</li>
    </ul>
    ${isTelehealth ? `<p><a href="${meetUrl}" class="btn-video">Join Video Call (Google Meet)</a></p>` : '<p>Clinic Address: 2638 Two Notch Rd. Suite 210 Unit 10, Columbia, SC 29204</p>'}
    <p>We look forward to seeing you!</p>
  </div>
</body>
</html>`;

  return await getTransporter().sendMail({
    from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: patientEmail,
    subject: `⏰ Upcoming Appointment Reminder – ${referenceNumber}`,
    html,
  });
}

async function sendPaymentConfirmation(paymentData) {
  const { patientEmail, patientName, doctorEmail, referenceNumber, amount, currency, serviceName } = paymentData;

  const patientHtml = `
  <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:auto;border:1px solid #E2E8F0;border-radius:12px;">
    <h2 style="color:#0F766E;">Payment Confirmation & Receipt</h2>
    <p>Dear ${escHtml(patientName)},</p>
    <p>Thank you for your payment. Your payment has been successfully processed.</p>
    <table style="width:100%;border-collapse:collapse;margin:15px 0;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>Reference:</strong></td><td>${escHtml(referenceNumber)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>Service:</strong></td><td>${escHtml(serviceName)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>Amount Paid:</strong></td><td><strong>$${(amount / 100).toFixed(2)} ${currency.toUpperCase()}</strong></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>Status:</strong></td><td><span style="color:#166534;font-weight:bold;">Paid / Verified</span></td></tr>
    </table>
    <p style="font-size:12px;color:#64748B;">UHS Healthcare Services &bull; (803) 381-7489</p>
  </div>`;

  const doctorHtml = `
  <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:auto;border:1px solid #CBD5E1;border-radius:12px;">
    <h2 style="color:#0F766E;">💰 Payment Received Notification</h2>
    <p>A new payment has been received for an appointment:</p>
    <ul>
      <li><strong>Patient:</strong> ${escHtml(patientName)} (${escHtml(patientEmail)})</li>
      <li><strong>Service:</strong> ${escHtml(serviceName)}</li>
      <li><strong>Reference:</strong> ${escHtml(referenceNumber)}</li>
      <li><strong>Amount Received:</strong> $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}</li>
    </ul>
  </div>`;

  // Send to Patient
  if (patientEmail) {
    await getTransporter().sendMail({
      from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
      to: patientEmail,
      subject: `💳 Payment Receipt – ${referenceNumber}`,
      html: patientHtml,
    });
  }

  // Send to Doctor / Admin
  const adminEmail = doctorEmail || process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@uhshealthcare.com';
  await getTransporter().sendMail({
    from: `"UHS Payments" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: adminEmail,
    subject: `💰 Payment Received: $${(amount / 100).toFixed(2)} from ${escHtml(patientName)}`,
    html: doctorHtml,
  });
}

async function sendFollowUpReminderEmail(patient, reminder) {
  const patientEmail = patient.email;
  const patientName = patient.fullName || `${patient.firstName} ${patient.lastName}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

  if (!patientEmail) return;

  const html = `
  <div style="font-family:'Plus Jakarta Sans',Segoe UI,sans-serif;max-width:600px;margin:20px auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;background:#fff;">
    <div style="background:linear-gradient(135deg,#0F766E,#0D9488);color:#fff;padding:28px 24px;text-align:center;">
      <h2 style="margin:0;font-size:22px;">⏰ Doctor Follow-Up & Appointment Reminder</h2>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">UHS Healthcare Services &bull; Nacole Brown MSN AGPCNP-BC</p>
    </div>
    <div style="padding:28px 24px;color:#1E293B;">
      <p>Dear <strong>${escHtml(patientName)}</strong>,</p>
      <p>This is a reminder from your healthcare provider regarding your recommended follow-up visit:</p>
      
      <div style="background:#F0FDF4;border-left:4px solid #0F766E;padding:16px;margin:20px 0;border-radius:8px;">
        <div style="font-size:12px;text-transform:uppercase;font-weight:700;color:#0F766E;">Agreed Follow-Up Timeframe</div>
        <div style="font-size:18px;font-weight:700;color:#166534;margin:4px 0;">${escHtml(reminder.timeframe || 'Follow-Up Visit')} (${reminder.followUpDate ? escHtml(new Date(reminder.followUpDate + 'T12:00:00').toLocaleDateString()) : 'As discussed'})</div>
        <hr style="border:none;border-top:1px solid #BBF7D0;margin:12px 0;">
        <div style="font-size:12px;text-transform:uppercase;font-weight:700;color:#0F766E;">Message from NP Nacole Brown:</div>
        <div style="font-size:15px;color:#1E293B;margin-top:4px;">"${escHtml(reminder.message || 'Please return for your scheduled follow-up consultation.')}"</div>
      </div>

      <p style="text-align:center;margin-top:28px;">
        <a href="${frontendUrl}/patient/" style="display:inline-block;padding:14px 28px;background:#0F766E;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Access Patient Portal & Book Follow-Up</a>
      </p>
      <p style="font-size:13px;color:#64748B;text-align:center;margin-top:16px;">
        You can also schedule by calling our clinic directly at <strong>(803) 381-7489</strong>.
      </p>
    </div>
    <div style="text-align:center;padding:16px;background:#F8FAFC;color:#94A3B8;font-size:12px;border-top:1px solid #E2E8F0;">
      UHS Healthcare Services &bull; 2638 Two Notch Rd. Suite 210 Unit 10, Columbia, SC 29204
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: patientEmail,
    subject: `⏰ Doctor Follow-Up & Appointment Reminder – UHS Healthcare`,
    html,
  });
}

async function sendStatusUpdate(appointment) {
  const { patientName, patientEmail, serviceName, isTelehealth, dateStr, meetUrl } = extractAppointmentData(appointment);
  const { referenceNumber, time, status } = appointment;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';

  if (!patientEmail) {
    console.warn('No patient email found — skipping status update for', referenceNumber);
    return null;
  }

  const isConfirmed = status === 'confirmed';
  const statusEmoji = isConfirmed ? '✅' : status === 'cancelled' ? '❌' : status === 'completed' ? '✔️' : '⏳';
  const statusColor = isConfirmed ? '#0F766E' : status === 'cancelled' ? '#DC2626' : status === 'completed' ? '#2563EB' : '#D97706';
  const subject = isConfirmed
    ? `✅ Appointment Confirmed – ${referenceNumber} (${serviceName})`
    : `📋 Appointment Update – ${referenceNumber} (Status: ${status})`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#F8FAFC;color:#1E293B;}
    .container{max-width:620px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);border:1px solid #E2E8F0;}
    .header{background:linear-gradient(135deg,${statusColor},${statusColor}dd);color:#FFFFFF;padding:36px 30px;text-align:center;}
    .header h1{margin:0;font-size:24px;font-weight:700;}
    .body{padding:32px 28px;}
    .status-badge{display:inline-block;padding:6px 16px;border-radius:20px;font-weight:700;font-size:13px;background:${statusColor}18;color:${statusColor};}
    .details{width:100%;border-collapse:collapse;margin:20px 0;}
    .details td{padding:12px 0;border-bottom:1px solid #F1F5F9;font-size:14px;}
    .details td:first-child{font-weight:600;color:#475569;width:130px;}
    .btn-portal{display:inline-block;margin-top:8px;padding:14px 28px;background:#0F766E;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(15,118,110,0.25);}
    .footer{text-align:center;padding:24px;background:#F8FAFC;color:#64748B;font-size:12px;border-top:1px solid #E2E8F0;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusEmoji} Appointment ${isConfirmed ? 'Confirmed' : 'Updated'}</h1>
      <p style="margin:6px 0 0;opacity:0.92;font-size:14px;">UHS Healthcare Services &bull; Direct Primary Care</p>
    </div>
    <div class="body">
      <p>Dear <strong>${escHtml(patientName)}</strong>,</p>
      <p>Your appointment status has been updated:</p>
      <div style="text-align:center;margin:20px 0;">
        <span class="status-badge">${isConfirmed ? '✅ Confirmed' : escHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span>
      </div>
      <table class="details">
        <tr><td>Reference</td><td><strong style="font-family:monospace;color:${statusColor};">${escHtml(referenceNumber)}</strong></td></tr>
        <tr><td>Service</td><td><strong>${escHtml(serviceName)}</strong></td></tr>
        <tr><td>Date</td><td>${escHtml(dateStr)}</td></tr>
        <tr><td>Time</td><td>${escHtml(time)}</td></tr>
      </table>
      ${isConfirmed ? `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <p style="margin:0 0 10px;font-size:14px;color:#166534;">Your appointment has been confirmed. You can view full details in your patient portal.</p>
        <a href="${frontendUrl}/patient/" class="btn-portal">🔐 View in My Portal</a>
      </div>` : `
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <p style="margin:0;font-size:14px;color:#991B1B;">For questions about this update, please call our clinic at <strong>(803) 381-7489</strong>.</p>
      </div>`}
    </div>
    <div class="footer">
      <p><strong>UHS Healthcare Services</strong> &bull; Columbia, SC &bull; (803) 381-7489</p>
      <p>2638 Two Notch Rd. Suite 210 Unit 10, Columbia, SC 29204</p>
    </div>
  </div>
</body>
</html>`;

  return await getTransporter().sendMail({
    from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: patientEmail,
    subject,
    html,
  });
}

async function sendPasswordResetEmail(patient, resetToken) {
  const patientEmail = patient.email;
  const patientName = patient.fullName || `${patient.firstName} ${patient.lastName}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const resetUrl = `${frontendUrl}/patient/?resetToken=${resetToken}`;

  if (!patientEmail) return;

  const html = `
  <div style="font-family:'Plus Jakarta Sans',Segoe UI,sans-serif;max-width:600px;margin:20px auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;background:#fff;">
    <div style="background:linear-gradient(135deg,#0F766E,#0D9488);color:#fff;padding:28px 24px;text-align:center;">
      <h2 style="margin:0;font-size:22px;">🔒 Password Reset Request</h2>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">UHS Healthcare Services</p>
    </div>
    <div style="padding:28px 24px;color:#1E293B;">
      <p>Dear <strong>${escHtml(patientName)}</strong>,</p>
      <p>We received a request to reset your patient portal password. Click the button below to set a new password:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#0F766E;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Reset My Password</a>
      </p>
      <p style="font-size:13px;color:#64748B;">This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    </div>
    <div style="text-align:center;padding:16px;background:#F8FAFC;color:#94A3B8;font-size:12px;border-top:1px solid #E2E8F0;">
      UHS Healthcare Services &bull; (803) 381-7489
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: `"UHS Healthcare Services" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: patientEmail,
    subject: `🔒 Password Reset Request – UHS Healthcare`,
    html,
  });
}

async function sendNewMessageNotification(messageData) {
  const { name, email, phone, subject, message } = messageData;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@uhshealthcare.com';

  const html = `
  <div style="font-family:'Plus Jakarta Sans',Segoe UI,sans-serif;max-width:600px;margin:20px auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;background:#fff;">
    <div style="background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;padding:28px 24px;text-align:center;">
      <h2 style="margin:0;font-size:22px;">✉️ New Contact Form Message</h2>
      <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">UHS Healthcare Admin Dashboard</p>
    </div>
    <div style="padding:28px 24px;color:#1E293B;">
      <p>A new message has been submitted through the contact form:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-weight:600;color:#475569;width:100px;">From</td><td>${escHtml(name)} (${escHtml(email)})</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-weight:600;color:#475569;">Phone</td><td>${escHtml(phone)}</td></tr>` : ''}
        ${subject ? `<tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-weight:600;color:#475569;">Subject</td><td>${escHtml(subject)}</td></tr>` : ''}
      </table>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin:16px 0;">
        <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#64748B;margin-bottom:6px;">Message</div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${escHtml(message)}</div>
      </div>
      <p style="text-align:center;margin-top:20px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin/" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">View in Admin Dashboard</a>
      </p>
    </div>
    <div style="text-align:center;padding:16px;background:#F8FAFC;color:#94A3B8;font-size:12px;border-top:1px solid #E2E8F0;">
      UHS Healthcare Services &bull; Automated Notification
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: `"UHS Contact Form" <${process.env.EMAIL_FROM || 'noreply@uhshealthcare.com'}>`,
    to: adminEmail,
    subject: `✉️ New Contact Message: ${escHtml(subject || 'No Subject')} – from ${escHtml(name)}`,
    html,
  });
}

module.exports = { sendConfirmation, sendReminderEmail, sendPaymentConfirmation, sendFollowUpReminderEmail, sendStatusUpdate, sendPasswordResetEmail, sendNewMessageNotification };


