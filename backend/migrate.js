require('dotenv').config();
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const { sequelize } = require('./config/db');

const migrationsDir = path.resolve(__dirname, 'migrations');

const umzug = new Umzug({
  sequelize,
  logging: console.log,
  storage: new SequelizeStorage({ sequelize }),
  migrations: {
    glob: ['*.js', { cwd: migrationsDir, absolute: true }],
  },
});

async function runMigrations() {
  try {
    const pending = await umzug.pending();
    console.log('[MIGRATIONS] Pending:', pending.length > 0 ? pending.map(p => p.name).join(', ') : 'none');
    await umzug.up();
    console.log('[MIGRATIONS] All migrations applied.');
  } catch (err) {
    console.error('[MIGRATIONS] Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = { runMigrations };
