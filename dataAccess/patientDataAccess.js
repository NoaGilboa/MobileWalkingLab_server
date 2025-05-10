const sql = require('mssql');
const dbConfig = require('../config/db');

class PatientDataAccess {
    // קבלת כל המטופלים
    static async getAllPatients() {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT * FROM patients;");
            return result.recordset; // מחזיר את רשימת המטופלים
        } catch (error) {
            throw new Error(`Error getting patients: ${error.message}`);
        }
    }

    // הוספת מטופל חדש
    static async addPatient(patientData) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('userId', sql.NVarChar, patientData.userId)
                .input('name', sql.NVarChar, patientData.name)
                .input('age', sql.Int, patientData.age)
                .input('gender', sql.NVarChar, patientData.gender)
                .query(`
                    INSERT INTO patients (userId, name, age, gender) 
                    VALUES (@userId, @name, @age, @gender);
                `);
            return result.rowsAffected[0] > 0; // מחזיר true אם נוספה בהצלחה
        } catch (error) {
            throw new Error(`Error adding patient: ${error.message}`);
        }
    }

    // קבלת מטופל לפי מזהה
    static async getPatientById(userId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('userId', sql.NVarChar, userId)
                .query("SELECT * FROM patients WHERE userId = @userId;");
            return result.recordset[0]; // מחזיר את המטופל או undefined אם לא נמצא
        } catch (error) {
            throw new Error(`Error retrieving patient: ${error.message}`);
        }
    }

    // קבלת כל ההערות של מטופל
    static async getNotesByPatientId(userId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('userId', sql.NVarChar, userId)
                .query("SELECT note FROM patient_notes WHERE userId = @userId;");
            return result.recordset.map(row => row.note); // מחזיר מערך של ההערות
        } catch (error) {
            throw new Error(`Error retrieving patient notes: ${error.message}`);
        }
    }

    // הוספת הערה למטופל
    static async addNoteToPatient(userId, note) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('userId', sql.NVarChar, userId)
                .input('note', sql.NVarChar, note)
                .query("INSERT INTO patient_notes (userId, note) VALUES (@userId, @note);");
            return result.rowsAffected[0] > 0; // מחזיר true אם נוספה בהצלחה
        } catch (error) {
            throw new Error(`Error adding note to patient: ${error.message}`);
        }
    }
}

module.exports = PatientDataAccess;
