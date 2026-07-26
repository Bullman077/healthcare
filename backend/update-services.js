/**
 * update-services.js
 * Replaces ALL existing services in the database with the 12 client-approved services.
 * Run with: node backend/update-services.js
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { sequelize } = require('./config/db');
const { Service } = require('./models');

const NEW_SERVICES = [
  {
    name: 'Healthcare Consultation',
    slug: 'healthcare-consultation',
    description: 'Comprehensive primary care consultation with NP Brown for new or existing health concerns, medication management, and personalized treatment planning.',
    duration: 45, price: 0, category: 'wellness', color: '#6A3FA0', isActive: true,
  },
  {
    name: 'Weight Loss Consultation',
    slug: 'weight-loss-consultation',
    description: 'Medically supervised weight management program with personalized nutrition guidance, GLP-1 therapy options, and ongoing progress tracking.',
    duration: 60, price: 0, category: 'wellness', color: '#8e44ad', isActive: true,
  },
  {
    name: 'Prescription Refill',
    slug: 'prescription-refill',
    description: 'Convenient prescription renewal and medication management review for established patients with chronic or ongoing conditions.',
    duration: 20, price: 0, category: 'wellness', color: '#a569bd', isActive: true,
  },
  {
    name: 'TB Skin Test',
    slug: 'tb-skin-test',
    description: 'PPD (Mantoux) tuberculin skin test for tuberculosis screening, required for employment, school enrollment, or travel clearance.',
    duration: 15, price: 0, category: 'diagnostic', color: '#5dade2', isActive: true,
  },
  {
    name: 'Weekly Vitamin B12 Injection',
    slug: 'vitamin-b12-injection',
    description: 'Intramuscular B12 (methylcobalamin) injection to boost energy levels, support neurological function, and address deficiency-related fatigue.',
    duration: 15, price: 0, category: 'wellness', color: '#27ae60', isActive: true,
  },
  {
    name: 'Iontophoresis Patch (1 Patch)',
    slug: 'iontophoresis-patch-single',
    description: 'Non-invasive transdermal drug delivery using a single medicated iontophoresis patch to reduce localized pain, inflammation, and swelling.',
    duration: 30, price: 0, category: 'therapy', color: '#9b59b6', isActive: true, requiresPreparation: false,
  },
  {
    name: 'Combination Therapy with Heat (2 Patches)',
    slug: 'combination-therapy-heat-2-patches',
    description: 'Advanced dual-patch iontophoresis combined with therapeutic heat application for enhanced anti-inflammatory penetration and accelerated healing.',
    duration: 45, price: 0, category: 'therapy', color: '#8e44ad', isActive: true, requiresPreparation: false,
  },
  {
    name: 'Target Back Pain / Knee Pain with Heat Therapy',
    slug: 'back-knee-pain-heat-therapy',
    description: 'Targeted therapeutic heat and patch therapy specifically designed to relieve chronic back pain, knee pain, and joint inflammation for improved mobility.',
    duration: 45, price: 0, category: 'therapy', color: '#7d3c98', isActive: true, requiresPreparation: false,
  },
  {
    name: 'DOT Physical',
    slug: 'dot-physical',
    description: "Federal Motor Carrier Safety Administration (FMCSA) compliant medical examination for commercial driver's license (CDL) holders and applicants.",
    duration: 45, price: 0, category: 'physical', color: '#0B2B4F', isActive: true,
  },
  {
    name: 'Non-DOT Physical',
    slug: 'non-dot-physical',
    description: 'General employment, pre-employment, or school physical examination for non-commercial settings, including vision and basic health screening.',
    duration: 30, price: 0, category: 'physical', color: '#1a5276', isActive: true,
  },
  {
    name: 'Comprehensive Health Assessment',
    slug: 'comprehensive-health-assessment',
    description: 'Thorough full-body wellness evaluation including vital signs, health history review, preventive screenings, and personalized health goal-setting.',
    duration: 60, price: 0, category: 'preventive', color: '#1f618d', isActive: true,
    requiresPreparation: true,
    preparationInstructions: 'Fast for 8 hours before if blood work is needed. Bring a list of current medications.',
  },
  {
    name: 'BLS CPR Training',
    slug: 'bls-cpr-training',
    description: 'American Heart Association Basic Life Support (BLS) certification course covering adult, child, and infant CPR, AED use, and airway management.',
    duration: 120, price: 0, category: 'training', color: '#c0392b', isActive: true,
    requiresPreparation: true,
    preparationInstructions: 'Wear comfortable clothing. Arrive 10 minutes early. Certification card issued upon completion.',
  },
];

async function updateServices() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database.');

    // Delete all existing services
    const deleted = await Service.destroy({ where: {}, truncate: false });
    console.log(`🗑  Deleted ${deleted} existing service(s).`);

    // Insert new services
    const created = await Service.bulkCreate(NEW_SERVICES);
    console.log(`✅ Created ${created.length} service(s):`);
    created.forEach((s) => console.log(`   • ${s.name}`));

    await sequelize.close();
    console.log('\n🎉 Service update complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating services:', err.message);
    process.exit(1);
  }
}

updateServices();
