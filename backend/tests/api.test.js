const request = require('supertest');
const { sequelize } = require('../config/db');
const { Admin, Patient, Service, Appointment, Message, AuditLog } = require('../models');
const bcrypt = require('bcryptjs');

let app;
let adminToken;
let patientToken;
let testAdmin;
let testService;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only_32chars!!';
  process.env.COOKIE_SECRET = 'test_cookie_secret_for_testing_only_32c!';
  process.env.FRONTEND_URL = 'http://localhost:3000';

  await sequelize.sync({ force: true });

  testAdmin = await Admin.create({
    email: 'test@uhshealthcare.com',
    password: 'TestPass123!',
    name: 'Test Admin',
    role: 'admin',
  });

  testService = await Service.create({
    name: 'DOT Physical',
    description: 'CDL driver medical exam.',
    duration: 45,
    price: 100,
    category: 'physical',
  });

  await Service.create({
    name: 'Telehealth Visit',
    description: 'Remote consultation.',
    duration: 30,
    price: 60,
    category: 'telehealth',
  });

  app = require('../server');
});

afterAll(async () => {
  await sequelize.close();
});

describe('Health Check', () => {
  it('GET /api/health should return success', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Admin Authentication', () => {
  it('POST /api/admin/login should return token with valid credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'test@uhshealthcare.com', password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.admin.email).toBe('test@uhshealthcare.com');
    adminToken = res.body.token;
  });

  it('POST /api/admin/login should fail with wrong password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'test@uhshealthcare.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/admin/login should fail with missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'test@uhshealthcare.com' });

    expect(res.status).toBe(400);
  });

  it('GET /api/admin/me should return admin profile', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe('test@uhshealthcare.com');
  });

  it('GET /api/admin/me should fail without auth', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
  });
});

describe('Admin Stats', () => {
  it('GET /api/admin/stats should return dashboard stats', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(typeof res.body.stats.total).toBe('number');
    expect(typeof res.body.stats.confirmed).toBe('number');
  });
});

describe('Services', () => {
  it('GET /api/services should return active public services', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.services.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/admin/services should return all services (admin)', async () => {
    const res = await request(app)
      .get('/api/admin/services')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.services.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/admin/services should create a service', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sports Physical',
        description: 'Pre-participation sports clearance.',
        duration: 30,
        price: 75,
        category: 'physical',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Sports Physical');
  });

  it('POST /api/admin/services should reject mass assignment', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Service',
        duration: 30,
        category: 'physical',
        id: 'should-be-ignored',
        createdAt: '2020-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.id).not.toBe('should-be-ignored');
  });
});

describe('Appointments', () => {
  let patientId;

  beforeAll(async () => {
    // Register a patient for auth-gated appointment tests
    if (!patientToken) {
      const res = await request(app)
        .post('/api/patient/register')
        .send({
          firstName: 'Test',
          lastName: 'Auth',
          email: 'testauth@example.com',
          phone: '(803) 555-0099',
          password: 'TestAuth123!',
        });
      if (res.status === 201) {
        patientToken = res.body.token;
      }
    }
  });

  it('POST /api/appointments should create an appointment', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'Test Patient',
        phone: '(803) 555-0100',
        email: 'testauth@example.com',
        service: 'DOT Physical',
        date: '2026-08-15',
        time: '10:00 AM',
        message: 'Test booking',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.referenceNumber).toMatch(/^UHS\d{6}$/);
    expect(res.body.data.service).toBe('DOT Physical');
  });

  it('POST /api/appointments should prevent double-booking same slot', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'Another Patient',
        phone: '(803) 555-0101',
        email: 'another@example.com',
        service: 'DOT Physical',
        date: '2026-08-15',
        time: '10:00 AM',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already booked');
  });

  it('POST /api/appointments should reject invalid service', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'Test',
        phone: '(803) 555-0100',
        email: 'test@example.com',
        service: 'Nonexistent Service',
        date: '2026-08-15',
        time: '11:00 AM',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available|invalid/i);
  });

  it('GET /api/appointments/by-email should require auth', async () => {
    const res = await request(app)
      .get('/api/appointments/by-email');
    expect(res.status).toBe(401);
  });

  it('GET /api/appointments/by-email should return appointments for authenticated patient', async () => {
    const res = await request(app)
      .get('/api/appointments/by-email')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Patient Portal', () => {
  it('POST /api/patient/register should create account', async () => {
    const res = await request(app)
      .post('/api/patient/register')
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        phone: '(803) 555-0200',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.patient.firstName).toBe('Jane');
    patientToken = res.body.token;
  });

  it('POST /api/patient/register should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/patient/register')
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        phone: '(803) 555-0200',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/patient/login should authenticate', async () => {
    const res = await request(app)
      .post('/api/patient/login')
      .send({ email: 'jane.doe@example.com', password: 'SecurePass123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    patientToken = res.body.token;
  });

  it('GET /api/patient/me should return patient profile', async () => {
    const res = await request(app)
      .get('/api/patient/me')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patient.email).toBe('jane.doe@example.com');
  });

  it('GET /api/patient/progress should return progress data', async () => {
    const res = await request(app)
      .get('/api/patient/progress')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.patientName).toBe('Jane Doe');
  });

  it('POST /api/patient/forgot-password should accept valid email', async () => {
    const res = await request(app)
      .post('/api/patient/forgot-password')
      .send({ email: 'jane.doe@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/patient/forgot-password should not reveal if email exists', async () => {
    const res = await request(app)
      .post('/api/patient/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Contact Messages', () => {
  it('POST /api/messages should create a message', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({
        name: 'John Smith',
        email: 'john@example.com',
        phone: '(803) 555-0300',
        message: 'I have a question about services.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('Audit Logs', () => {
  it('GET /api/admin/audit-logs should return logs', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});

describe('Security', () => {
  it('Should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('Should reject oversized payloads', async () => {
    const largePayload = { data: 'x'.repeat(20000) };
    const res = await request(app)
      .post('/api/messages')
      .send(largePayload);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
