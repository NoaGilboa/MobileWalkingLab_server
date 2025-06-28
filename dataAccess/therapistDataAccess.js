const sql = require('mssql');
const dbConfig = require('../config/db');

class TherapistDataAccess {
    static async addTherapist(therapistData) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('therapist_id', sql.NVarChar, therapistData.therapist_id)
                .input('name', sql.NVarChar, therapistData.name)
                .input('email', sql.NVarChar, therapistData.email)
                .input('password', sql.NVarChar, therapistData.password)
                .query(`
                    INSERT INTO therapists (therapist_id, name, email, password) 
                    VALUES (@therapist_id, @name, @email, @password);
                `);
            return result.rowsAffected[0] > 0;
        } catch (error) {
            throw new Error(`Error adding therapist: ${error.message}`);
        }
    }

    static async getTherapistByEmail(email) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('email', sql.NVarChar, email)
                .query(`SELECT * FROM therapists WHERE email = @email;`);
            return result.recordset[0];
        } catch (error) {
            throw new Error(`Error retrieving therapist: ${error.message}`);
        }
    }

    static async updateTherapistName(therapistId, newName) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('therapist_id', sql.NVarChar, therapistId)
            .input('name', sql.NVarChar, newName)
            .query(`
                UPDATE therapists
                SET name = @name
                WHERE therapist_id = @therapist_id;

                SELECT * FROM therapists WHERE therapist_id = @therapist_id;
            `);
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Error updating therapist name: ${error.message}`);
    }
}
}

module.exports = TherapistDataAccess;