// tests/therapistController.test.js

const request = require('supertest');
const app = require('../server');
const { connectDB, sql } = require('../config/db');

let testTherapistId = 'therapist-001';

beforeAll(async () => {
  await connectDB();
  const pool = await sql.connect();

  // נקה את הנתונים הקיימים
  await pool.request().query(`DELETE FROM therapists WHERE therapist_id = '${testTherapistId}'`);
});

afterAll(async () => {
  const pool = await sql.connect();
  await pool.request().query(`DELETE FROM therapists WHERE therapist_id = '${testTherapistId}'`);
  await sql.close();
});

describe('TherapistController API Tests', () => {
  test('POST /api/therapists/register should register a new therapist', async () => {
    const res = await request(app).post('/api/therapists/register').send({
      therapist_id: testTherapistId,
      name: 'Thera P.',
      email: 'thera@example.com',
      password: 'securepass'
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Therapist registered successfully');
  });

  test('POST /api/therapists/login should login successfully', async () => {
    const res = await request(app).post('/api/therapists/login').send({
      email: 'thera@example.com',
      password: 'securepass'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Login successful');
    expect(res.body.therapist).toHaveProperty('email', 'thera@example.com');
  });

  test('POST /api/therapists/login with wrong password should fail', async () => {
    const res = await request(app).post('/api/therapists/login').send({
      email: 'thera@example.com',
      password: 'wrongpass'
    });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('message', 'Invalid email or password');
  });

});
