/*
 * cleanup_test_data.js
 *
 * This script removes all patient records (and their associated appointments)
 * except for patients whose first name is Morris, Alex, or John.
 * It is intended for development/testing environments only.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { sequelize } = require('./config/db'); // adjust path if needed
const { Patient, Appointment } = require('./models');
const { Op } = require('sequelize');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Names of patients to keep (case‑sensitive as stored in DB)
    const keepFirstNames = ['Morris', 'Alex', 'John'];

    // Find IDs of patients to keep
    const patientsToKeep = await Patient.findAll({
      attributes: ['id', 'firstName', 'lastName'],
      where: { firstName: { [Op.in]: keepFirstNames } },
    });
    const keepIds = patientsToKeep.map(p => p.id);
    console.log('Preserving patients:', patientsToKeep.map(p => `${p.firstName} ${p.lastName}`).join(', '));

    // Delete appointments belonging to patients that will be removed
    const deleteApptResult = await Appointment.destroy({
      where: {
        patientId: keepIds.length ? { [Op.notIn]: keepIds } : { [Op.ne]: null },
      },
    });
    console.log(`Deleted ${deleteApptResult} appointment(s) of test patients.`);

    // Delete patients not in the keep list
    const deletePatientResult = await Patient.destroy({
      where: { firstName: { [Op.notIn]: keepFirstNames } },
    });
    console.log(`Deleted ${deletePatientResult} patient record(s).`);

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
})();
