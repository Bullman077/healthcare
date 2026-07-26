const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { sequelize } = require('./config/db');
const { Patient, Service, Appointment, Admin } = require('./models');

async function seed() {
  await sequelize.authenticate();
  console.log('Connected to PostgreSQL');

  // Sync all models (create tables if they don't exist)
  // Use 'alter' only in development; never use 'force' in production
  const syncOpts = process.env.NODE_ENV === 'production' ? {} : { alter: true };
  await sequelize.sync(syncOpts);
  console.log('Tables synced');

  await Admin.create({
    email: process.env.ADMIN_EMAIL || 'admin@uhshealthcare.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    name: 'Nacole Brown',
    role: 'superadmin',
  });
  console.log('Admin created');

  const servicesData = [
    { name: 'Healthcare Consultation', slug: 'healthcare-consultation', description: 'Comprehensive primary care consultation with NP Brown for new or existing health concerns, medication management, and personalized treatment planning.', duration: 45, price: 0, category: 'wellness', color: '#6A3FA0' },
    { name: 'Weight Loss Consultation', slug: 'weight-loss-consultation', description: 'Medically supervised weight management program with personalized nutrition guidance, GLP-1 therapy options, and ongoing progress tracking.', duration: 60, price: 0, category: 'wellness', color: '#8e44ad' },
    { name: 'Prescription Refill', slug: 'prescription-refill', description: 'Convenient prescription renewal and medication management review for established patients with chronic or ongoing conditions.', duration: 20, price: 0, category: 'wellness', color: '#a569bd' },
    { name: 'TB Skin Test', slug: 'tb-skin-test', description: 'PPD (Mantoux) tuberculin skin test for tuberculosis screening, required for employment, school enrollment, or travel clearance.', duration: 15, price: 0, category: 'diagnostic', color: '#5dade2' },
    { name: 'Weekly Vitamin B12 Injection', slug: 'vitamin-b12-injection', description: 'Intramuscular B12 (methylcobalamin) injection to boost energy levels, support neurological function, and address deficiency-related fatigue.', duration: 15, price: 0, category: 'wellness', color: '#27ae60' },
    { name: 'Iontophoresis Patch (1 Patch)', slug: 'iontophoresis-patch-single', description: 'Non-invasive transdermal drug delivery using a single medicated iontophoresis patch to reduce localized pain, inflammation, and swelling.', duration: 30, price: 0, category: 'therapy', color: '#9b59b6', requiresPreparation: false },
    { name: 'Combination Therapy with Heat (2 Patches)', slug: 'combination-therapy-heat-2-patches', description: 'Advanced dual-patch iontophoresis combined with therapeutic heat application for enhanced anti-inflammatory penetration and accelerated healing.', duration: 45, price: 0, category: 'therapy', color: '#8e44ad', requiresPreparation: false },
    { name: 'Target Back Pain / Knee Pain with Heat Therapy', slug: 'back-knee-pain-heat-therapy', description: 'Targeted therapeutic heat and patch therapy specifically designed to relieve chronic back pain, knee pain, and joint inflammation for improved mobility.', duration: 45, price: 0, category: 'therapy', color: '#7d3c98', requiresPreparation: false },
    { name: 'DOT Physical', slug: 'dot-physical', description: 'Federal Motor Carrier Safety Administration (FMCSA) compliant medical examination for commercial driver\'s license (CDL) holders and applicants.', duration: 45, price: 0, category: 'physical', color: '#0B2B4F' },
    { name: 'Non-DOT Physical', slug: 'non-dot-physical', description: 'General employment, pre-employment, or school physical examination for non-commercial settings, including vision and basic health screening.', duration: 30, price: 0, category: 'physical', color: '#1a5276' },
    { name: 'Comprehensive Health Assessment', slug: 'comprehensive-health-assessment', description: 'Thorough full-body wellness evaluation including vital signs, health history review, preventive screenings, and personalized health goal-setting.', duration: 60, price: 0, category: 'preventive', color: '#1f618d', requiresPreparation: true, preparationInstructions: 'Fast for 8 hours before if blood work is needed. Bring a list of current medications.' },
    { name: 'BLS CPR Training', slug: 'bls-cpr-training', description: 'American Heart Association Basic Life Support (BLS) certification course covering adult, child, and infant CPR, AED use, and airway management.', duration: 120, price: 0, category: 'training', color: '#c0392b', requiresPreparation: true, preparationInstructions: 'Wear comfortable clothing. Arrive 10 minutes early. Certification card issued upon completion.' },
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
