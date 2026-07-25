const { Sequelize } = require('sequelize');
const { URL } = require('url');

let sequelize;

if (process.env.NODE_ENV === 'test') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });
} else {
  const dbUrl = process.env.DATABASE_URL;

  // SSL certificate verification.
  // Default: true (verify cert) in production, false in development.
  // Override via DB_SSL_REJECT_UNAUTHORIZED env var.
  const isProd = process.env.NODE_ENV === 'production';
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== undefined
    ? process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
    : isProd;

  if (dbUrl) {
    const parsed = new URL(dbUrl);
    const isRemote = !['localhost', '127.0.0.1'].includes(parsed.hostname);

    sequelize = new Sequelize(
      parsed.pathname.replace(/^\//, ''),
      parsed.username,
      parsed.password,
      {
        host: parsed.hostname,
        port: parsed.port || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: isRemote ? {
          ssl: {
            require: true,
            rejectUnauthorized,
          },
        } : {},
        // Keep pool small — Aiven free tier allows ~25 total connections.
        // With PM2 cluster (2 workers) this reserves ≤16 connections total.
        pool: { max: 8, min: 0, acquire: 30000, idle: 10000 },
      }
    );
  } else {
    sequelize = new Sequelize({
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      dialect: 'postgres',
      logging: false,
      pool: { max: 8, min: 0, acquire: 30000, idle: 10000 },
    });
  }
}

async function connectDB() {
  await sequelize.authenticate();
  console.log(`PostgreSQL connected successfully.`);
}

module.exports = { sequelize, connectDB };
