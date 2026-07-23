const { Sequelize } = require('sequelize');

let dbUrl = process.env.DATABASE_URL || '';
const isRemote = dbUrl.includes('sslmode=require') || (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && dbUrl.startsWith('postgres'));

if (isRemote) {
  dbUrl = dbUrl.replace(/[?&]sslmode=[^&]*/, '');
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: isRemote ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
  pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
});

async function connectDB() {
  await sequelize.authenticate();
  console.log(`PostgreSQL connected successfully.`);
}

module.exports = { sequelize, connectDB };



