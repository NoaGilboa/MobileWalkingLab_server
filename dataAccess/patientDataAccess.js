// PatientDataAccess.js

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
                .input('patient_id', sql.NVarChar, patientData.patient_id)
                .input('first_name', sql.NVarChar, patientData.first_name)
                .input('last_name', sql.NVarChar, patientData.last_name)
                .input('birth_date', sql.Date, patientData.birth_date)
                .input('gender', sql.NVarChar, patientData.gender)
                .input('weight', sql.Float, patientData.weight)
                .input('height', sql.Float, patientData.height)
                .input('phone', sql.NVarChar, patientData.phone)
                .input('email', sql.NVarChar, patientData.email)
                .input('medical_condition', sql.NVarChar, patientData.medical_condition)
                .input('mobility_status', sql.NVarChar, patientData.mobility_status)
                .input('updated_at', sql.DateTime, new Date())
                .query(`
                    INSERT INTO patients (
                        patient_id, first_name, last_name, birth_date, gender, weight, height,
                        phone, email, medical_condition, mobility_status, updated_at
                    )
                    VALUES (
                        @patient_id, @first_name, @last_name, @birth_date, @gender, @weight, @height,
                        @phone, @email, @medical_condition, @mobility_status, @updated_at
                    );
                `);
            return result.rowsAffected[0] > 0; // מחזיר true אם נוספה בהצלחה
        } catch (error) {
            throw new Error(`Error adding patient: ${error.message}`);
        }
    }

    // קבלת מטופל לפי מזהה
    static async getPatientById(id) {
    
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.Int, id)
                .query("SELECT * FROM patients WHERE id = @id;");
            return result.recordset[0]; // מחזיר את המטופל או undefined אם לא נמצא
        } catch (error) {
            throw new Error(`Error retrieving patient: ${error.message}`);
        }
    }

    // קבלת כל ההערות של מטופל
    static async getNotesByPatientId(patient_id) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('patient_id', sql.Int, patient_id)
                .query(`
                    SELECT note, created_by_name, created_at
                    FROM patient_notes
                    WHERE patient_id = @patient_id
                    ORDER BY created_at DESC
                `);            
                return result.recordset; // מחזיר מערך של ההערות
        } catch (error) {
            throw new Error(`Error retrieving patient notes: ${error.message}`);
        }
    }

    // הוספת הערה למטופל
    static async addNoteToPatient(userId, note) {
        try {
            const pool = await sql.connect(dbConfig);
            // שלב 1 – שליפת שם הפיזיותרפיסט
            const therapistResult = await pool.request()
                .input('therapist_id', sql.Int, therapistId)
                .query("SELECT name FROM therapists WHERE id = @therapist_id;");
            const therapistName = therapistResult.recordset[0]?.name;

            if (!therapistName) {
                throw new Error("Therapist not found.");
            }

            // שלב 2 – הכנסת ההערה כולל שם הפיזיותרפיסט
            const result = await pool.request()
                .input('patient_id', sql.Int, patientId)
                .input('therapist_id', sql.Int, therapistId)
                .input('created_by_name', sql.NVarChar, therapistName)
                .input('note', sql.NVarChar, note)
                .query(`
            INSERT INTO patient_notes (patient_id, therapist_id, created_by_name, note)
            VALUES (@patient_id, @therapist_id, @created_by_name, @note);
        `);

            return result.rowsAffected[0] > 0; // מחזיר true אם נוספה בהצלחה
        } catch (error) {
            throw new Error(`Error adding note to patient: ${error.message}`);
        }
    }

    static async updatePatient(id, patientData) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.Int, id)
                .input('first_name', sql.NVarChar, patientData.first_name)
                .input('last_name', sql.NVarChar, patientData.last_name)
                .input('birth_date', sql.Date, patientData.birth_date)
                .input('gender', sql.NVarChar, patientData.gender)
                .input('weight', sql.Float, patientData.weight)
                .input('height', sql.Float, patientData.height)
                .input('phone', sql.NVarChar, patientData.phone)
                .input('email', sql.NVarChar, patientData.email)
                .input('medical_condition', sql.NVarChar, patientData.medical_condition)
                .input('mobility_status', sql.NVarChar, patientData.mobility_status)
                .input('updated_at', sql.DateTime, new Date())
                .query(`
                    UPDATE patients SET
                        first_name = @first_name,
                        last_name = @last_name,
                        birth_date = @birth_date,
                        gender = @gender,
                        weight = @weight,
                        height = @height,
                        phone = @phone,
                        email = @email,
                        medical_condition = @medical_condition,
                        mobility_status = @mobility_status,
                        updated_at = @updated_at
                    WHERE id = @id;
                `);
            return result.rowsAffected[0] > 0;
        } catch (error) {
            throw new Error(`Error updating patient: ${error.message}`);
        }
    }

    static async deletePatient(id) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.Int, id)
                .query("DELETE FROM patients WHERE id = @id;");
            return result.rowsAffected[0] > 0;
        } catch (error) {
            throw new Error(`Error deleting patient: ${error.message}`);
        }
    } 
}



module.exports = PatientDataAccess;
