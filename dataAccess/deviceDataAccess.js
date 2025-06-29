// DeviceDataAccess.js

const sql = require('mssql');
const dbConfig = require('../config/db');

class DeviceDataAccess {
// שמירת מדידות מהבקר
static async saveDeviceMeasurements(patientId, measurements) {
    const pool = await sql.connect(dbConfig);

    for (const m of measurements) {
        await pool.request()
            .input('patient_id', sql.Int, patientId)
            .input('speed', sql.Float, m.speed)
            .input('distance', sql.Float, m.distance)
            .input('handPressureL', sql.Float, m.handPressureL)
            .input('handPressureR', sql.Float, m.handPressureR)
            .input('footLiftL', sql.Int, m.footLiftL)
            .input('footLiftR', sql.Int, m.footLiftR)
            .query(`
                INSERT INTO device_measurements (
                  patient_id, speed, distance,
                  handPressureL, handPressureR,
                  footLiftL, footLiftR
                )
                VALUES (
                  @patient_id, @speed, @distance,
                  @handPressureL, @handPressureR,
                  @footLiftL, @footLiftR
                )
            `);
    }
}

// שליפות נפרדות
static async getDeviceMeasurements(patientId, fieldNames) {
    const pool = await sql.connect(dbConfig);
    const fields = fieldNames.join(', ');
    const result = await pool.request()
        .input('patient_id', sql.Int, patientId)
        .query(`
            SELECT ${fields}, measured_at
            FROM device_measurements
            WHERE patient_id = @patient_id
            ORDER BY measured_at DESC
        `);
    return result.recordset;
}


}

module.exports = DeviceDataAccess;
