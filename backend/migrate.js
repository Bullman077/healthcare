require('dotenv').config();
const { sequelize } = require('./config/db');

async function migrate() {
  try {
    await sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255);');
    await sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "progressNotes" TEXT;');
    await sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "medicalProgress" JSONB DEFAULT \'[]\';');
    await sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "reminders" JSONB DEFAULT \'[]\';');
    await sequelize.query('ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "meetingUrl" VARCHAR(500);');
    await sequelize.query('ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN DEFAULT false;');
    console.log('✅ All PostgreSQL database columns migrated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
