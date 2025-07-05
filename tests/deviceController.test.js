// tests/deviceController.test.js

const request = require('supertest');
const app = require('../server');
const { connectDB, sql } = require('../config/db');

let testPatientId;

beforeAll(async () => {
  await connectDB();
  // יצירת מטופל לבדיקה
  const pool = await sql.connect();
  await pool.request().query(`
    DELETE FROM device_measurements WHERE patient_id IN (
      SELECT id FROM patients WHERE patient_id = 'test-patient-001'
    );
    DELETE FROM patients WHERE patient_id = 'test-patient-001';
  `);
  const result = await pool.request().query(`
      INSERT INTO patients (patient_id, first_name, last_name, birth_date)
      OUTPUT inserted.id
      VALUES ('test-patient-001', 'Test', 'Patient', '1990-01-01')
    `);
  testPatientId = result.recordset[0].id;

  // הוספת מדידות לדוגמה
  await pool.request().query(`
      INSERT INTO device_measurements 
      (patient_id, speed, distance, handPressureL, handPressureR, footLiftL, footLiftR)
      VALUES (${testPatientId}, 2.3, 5.5, 0.7, 0.8, 3, 2)
    `);
});

afterAll(async () => {
  // מחיקת המדידות והמטופל
  const pool = await sql.connect();
  await pool.request().query(`DELETE FROM device_measurements WHERE patient_id = ${testPatientId}`);
  await pool.request().query(`DELETE FROM patients WHERE id = ${testPatientId}`);
  await sql.close();
});

describe('DeviceController API Tests', () => {
  test('GET /api/device/command should return default idle command', async () => {
    const response = await request(app).get('/api/device/command');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('command');
    expect(['start', 'stop', 'idle']).toContain(response.body.command.command);
  });

  test('POST /api/device/command should set valid command', async () => {
    const response = await request(app)
      .post('/api/device/command')
      .send({ command: 'start', patientId: testPatientId });
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Command updated successfully');
  });

  test('POST /api/device/command with invalid command should return 400', async () => {
    const response = await request(app)
      .post('/api/device/command')
      .send({ command: 'jump', patientId: testPatientId });
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid command');
  });

  test('POST /api/device/:id/data with empty array should return 400', async () => {
    const response = await request(app)
      .post(`/api/device/${testPatientId}/data`)
      .send([]);
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'No measurements provided');
  });

  test('GET /api/device/:id/measurements should return grouped fields', async () => {
    const response = await request(app)
      .get(`/api/device/${testPatientId}/measurements`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('speed');
    expect(response.body).toHaveProperty('distance');
    expect(response.body).toHaveProperty('footLiftL');
  });
});
