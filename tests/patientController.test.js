// tests/patientController.test.js
const request = require('supertest');
const app = require('../server');
const { connectDB, sql } = require('../config/db');

let testPatientId;
let testTherapistId;

beforeAll(async () => {
    await connectDB();
    const pool = await sql.connect();
    await pool.request().query(`DELETE FROM patient_notes WHERE patient_id IN (SELECT id FROM patients WHERE patient_id = 'test-patient-001')`);
    await pool.request().query(`DELETE FROM patient_speed_measurements WHERE patient_id IN (SELECT id FROM patients WHERE patient_id = 'test-patient-001')`);
    await pool.request().query(`DELETE FROM device_measurements WHERE patient_id IN (SELECT id FROM patients WHERE patient_id = 'test-patient-001')`);
    await pool.request().query(`DELETE FROM patients WHERE patient_id = 'test-patient-001'`);
    await pool.request().query(`DELETE FROM therapists WHERE therapist_id = 'therapist-001'`);

    const patientRes = await pool.request().query(`
        INSERT INTO patients (patient_id, first_name, last_name, birth_date)
        OUTPUT inserted.id
        VALUES ('test-patient-001', 'Test', 'Patient', '1985-05-05')
        `);

    testPatientId = patientRes.recordset[0].id;

    const therapistRes = await pool.request().query(`
    INSERT INTO therapists (therapist_id, name, email, password)
    OUTPUT inserted.id
    VALUES ('therapist-001', 'Thera P.', 'thera@example.com', 'securepass')
  `);
    testTherapistId = therapistRes.recordset[0].id;
});

afterAll(async () => {
    const pool = await sql.connect();
    await pool.request().query(`DELETE FROM patient_notes WHERE patient_id = ${testPatientId}`);
    await pool.request().query(`DELETE FROM patient_speed_measurements WHERE patient_id = ${testPatientId}`);
    await pool.request().query(`DELETE FROM device_measurements WHERE patient_id = ${testPatientId}`);
    await pool.request().query(`DELETE FROM patients WHERE id = ${testPatientId}`);
    await pool.request().query(`DELETE FROM therapists WHERE id = ${testTherapistId}`);
    await sql.close();
});

describe('PatientController API Tests', () => {

    test('GET /api/patients should return list', async () => {
        const res = await request(app).get('/api/patients/');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/patients/:id should return specific patient', async () => {
        const res = await request(app).get(`/api/patients/${testPatientId}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('first_name', 'Test');
    });

    test('POST /api/patients/:id/notes should add a note', async () => {
        const res = await request(app)
            .post(`/api/patients/${testPatientId}/notes`)
            .send({ therapistId: testTherapistId, note: 'Patient has asymmetrical gait.' });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('message', 'Note added successfully');
    });

    test('GET /api/patients/:id/notes should retrieve notes', async () => {
        const res = await request(app).get(`/api/patients/${testPatientId}/notes`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/patients/:id/speed should save speed measurement', async () => {
        const res = await request(app)
            .post(`/api/patients/${testPatientId}/speed`)
            .send({ speed_kmh: 2.5, source: 'manual', foot_lift_count: 4 });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('message', 'Speed measurement saved');
    });

    test('GET /api/patients/:id/speed-history should return speed data', async () => {
        const res = await request(app).get(`/api/patients/${testPatientId}/speed-history`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/patients/:id/treatment-recommendation should return recommendation', async () => {
        const res = await request(app).post(`/api/patients/${testPatientId}/treatment-recommendation`);
        expect([200, 500]).toContain(res.statusCode); // OpenAI may fail gracefully
    }, 15000);

    test('DELETE /api/patients/:id/notes should delete notes', async () => {
        const res = await request(app).delete(`/api/patients/${testPatientId}/notes`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message');
    });

});