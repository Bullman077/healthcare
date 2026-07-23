const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { sequelize } = require('./config/db');
const { Patient, Service, Appointment, Admin } = require('./models');

async function seed() {
  await sequelize.authenticate();
  console.log('Connected to PostgreSQL');

  // Sync all models (create tables if they don't exist)
  await sequelize.sync({ force: true });
  console.log('Tables created / reset');

  await Admin.create({
    email: process.env.ADMIN_EMAIL || 'admin@uhshealthcare.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    name: 'Nacole Brown',
    role: 'superadmin',
  });
  console.log('Admin created');

  const servicesData = [
    { name: 'DOT Physical', slug: 'dot-physical', description: 'CDL driver medical exam per FMCSA standards.', duration: 45, price: 100, category: 'physical', color: '#0B2B4F' },
    { name: 'Non-DOT Physical', slug: 'non-dot-physical', description: 'General employment physical examination.', duration: 30, price: 80, category: 'physical', color: '#1a5276' },
    { name: 'Sports Physical', slug: 'sports-physical', description: 'Pre-participation sports clearance exam.', duration: 30, price: 75, category: 'physical', color: '#2e86c1' },
    { name: 'Work Physical', slug: 'work-physical', description: 'Occupational health physical for employers.', duration: 30, price: 85, category: 'physical', color: '#1f618d' },
    { name: 'Weight Management', slug: 'weight-management', description: 'Personalized nutrition and weight loss planning.', duration: 60, price: 120, category: 'wellness', color: '#6A3FA0' },
    { name: 'Telehealth Visit', slug: 'telehealth-visit', description: 'Remote consultation via secure video.', duration: 30, price: 60, category: 'telehealth', color: '#a569bd' },
    { name: 'TB Skin Testing', slug: 'tb-skin-testing', description: 'PPD skin test for tuberculosis screening.', duration: 15, price: 40, category: 'diagnostic', color: '#5dade2' },
    { name: 'BLS CPR Training', slug: 'bls-cpr-training', description: 'American Heart Association BLS certification.', duration: 120, price: 75, category: 'training', color: '#e74c3c', requiresPreparation: true, preparationInstructions: 'Wear comfortable clothing. Arrive 10 minutes early.' },
    { name: 'Chronic Pain Relief', slug: 'chronic-pain-relief', description: 'Non-opioid pain management strategies.', duration: 45, price: 110, category: 'therapy', color: '#8e44ad' },
    { name: 'Iontophoresis Patch Therapy', slug: 'iontophoresis-patch-therapy', description: 'Medicated patch delivery for localized treatment.', duration: 30, price: 95, category: 'therapy', color: '#9b59b6' },
    { name: 'Preventive Wellness', slug: 'preventive-wellness', description: 'Annual physical, labs, and health screening.', duration: 60, price: 150, category: 'preventive', color: '#27ae60', requiresPreparation: true, preparationInstructions: 'Fast for 8 hours before if blood work is needed.' },
  ];

  const services = await Service.bulkCreate(servicesData);
  console.log(`Services created: ${services.length}`);

  const patientData = [
    { firstName: 'Sarah', lastName: 'Johnson', phone: '(555) 101-2001', email: 'sarah.j@example.com', status: 'active' },
    { firstName: 'Michael', lastName: 'Chen', phone: '(555) 101-2002', email: 'michael.chen@example.com', status: 'active' },
    { firstName: 'Emily', lastName: 'Rodriguez', phone: '(555) 101-2003', email: 'emily.r@example.com', status: 'active' },
    { firstName: 'James', lastName: 'Williams', phone: '(555) 101-2004', email: 'james.w@example.com', status: 'active' },
    { firstName: 'Amanda', lastName: 'Taylor', phone: '(555) 101-2005', email: 'amanda.t@example.com', status: 'active' },
    { firstName: 'David', lastName: 'Brown', phone: '(555) 101-2006', email: 'david.brown@example.com', status: 'active' },
    { firstName: 'Jessica', lastName: 'Martinez', phone: '(555) 101-2007', email: 'jessica.m@example.com', status: 'active' },
    { firstName: 'Robert', lastName: 'Davis', phone: '(555) 101-2008', email: 'robert.d@example.com', status: 'active' },
    { firstName: 'Michelle', lastName: 'Garcia', phone: '(555) 101-2009', email: 'michelle.g@example.com', status: 'inactive' },
    { firstName: 'Christopher', lastName: 'Wilson', phone: '(555) 101-2010', email: 'chris.w@example.com', status: 'active' },
  ];

  const patients = await Patient.bulkCreate(patientData);
  console.log(`Patients created: ${patients.length}`);

  const times = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'];
  const statuses = ['confirmed', 'confirmed', 'completed', 'completed', 'cancelled'];
  const today = new Date();
  const appointments = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2 + i);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);

    appointments.push({
      patientId: patients[i % patients.length].id,
      serviceId: services[i % services.length].id,
      date: d.toISOString().split('T')[0],
      time: times[i % times.length],
      duration: services[i % services.length].duration,
      status: statuses[i % statuses.length],
      patientNotes: i % 3 === 0 ? 'First visit.' : '',
    });
  }

  const created = await Appointment.bulkCreate(appointments);
  console.log(`Appointments created: ${created.length}`);

  await sequelize.close();
  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
