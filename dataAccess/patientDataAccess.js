// PatientDataAccess.js

const sql = require('mssql');
const dbConfig = require('../config/db');

const PATIENT_SORT_WHITELIST = new Set(['id', 'patient_id', 'first_name', 'last_name', 'created_at', 'updated_at']);
const NOTE_SORT_WHITELIST    = new Set(['id', 'created_at', 'updated_at', 'user_id', 'therapist_id']);

function safeSort(sortBy, whitelist, fallback) {
  if (!sortBy) return fallback;
  const s = String(sortBy);
  return whitelist.has(s) ? s : fallback;
}

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
    static async addNoteToPatient(patientId, therapistId, note) {
        try {
            const pool = await sql.connect(dbConfig);
            // שלב 1 – שליפת שם הפיזיותרפיסט
            const therapistResult = await pool.request()
                .input('therapistId', sql.Int, therapistId)
                .query("SELECT name FROM therapists WHERE id = @therapistId;");
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
            console.error("1111Add note error:", error);
            throw new Error(`Errorr adding note to patient: ${error.message}, therapistId: ${therapistId}, patientId: ${patientId}`);
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

    // מחיקת כל ההערות של מטופל לפי patient_id
static async deleteNotesByPatientId(patientId) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('patient_id', sql.Int, patientId)
            .query(`DELETE FROM patient_notes WHERE patient_id = @patient_id;`);
        return result.rowsAffected[0] > 0;
    } catch (error) {
        throw new Error(`Error deleting notes: ${error.message}`);
    }
}



// שמירת מדידת מהירות
static async saveSpeedMeasurement(patientId, speedKmh, source = 'manual', footLiftCount = null) {
    const pool = await sql.connect(dbConfig);
    await pool.request()
        .input('patient_id', sql.Int, patientId)
        .input('speed_kmh', sql.Float, speedKmh)
        .input('source', sql.NVarChar, source)
        .input('foot_lift_count', sql.Int, footLiftCount)
        .query(`
            INSERT INTO patient_speed_measurements (patient_id, speed_kmh, source, foot_lift_count)
            VALUES (@patient_id, @speed_kmh, @source, @foot_lift_count)
        `);
}

// שליפת היסטוריית מהירויות
static async getSpeedHistory(patientId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('patient_id', sql.Int, patientId)
        .query(`
            SELECT speed_kmh, measured_at, source, foot_lift_count
            FROM patient_speed_measurements
            WHERE patient_id = @patient_id
            ORDER BY measured_at DESC
        `);
    return result.recordset;
}

static async getAllPatientsPaginated({ page, pageSize, sortBy = 'id', sortDir = 'ASC' }) {
  try {
    const pool = await sql.connect(dbConfig);

    const safeSortBy = safeSort(sortBy, PATIENT_SORT_WHITELIST, 'id');
    const dir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const offset = page * pageSize;

    // סה"כ
    const totalRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM patients;`);
    const total = totalRes.recordset[0].cnt;

    // אם אין רשומות – החזרה מהירה
    if (!total) {
      return {
        data: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: page > 0,
        sortBy: safeSortBy,
        sortDir: dir,
      };
    }

    // שימי לב: לא ניתן לפרמטר שם עמודה, לכן משתמשים בלובן ואז ב־template
    const query = `
      SELECT id, patient_id, first_name, last_name, birth_date, gender, weight, height,
             phone, email, medical_condition, mobility_status, created_at, updated_at
      FROM patients
      ORDER BY ${safeSortBy} ${dir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const res = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, pageSize)
      .query(query);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: res.recordset,
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page + 1 < totalPages,
      hasPrev: page > 0,
      sortBy: safeSortBy,
      sortDir: dir,
    };
  } catch (error) {
    throw new Error(`Error getting patients (paginated): ${error.message}`);
  }
}

static async getNotesByPatientIdPaginated(patientId, { page, pageSize, sortBy = 'created_at', sortDir = 'DESC' }) {
  try {
    const pool = await sql.connect(dbConfig);

    const safeSortBy = safeSort(sortBy, NOTE_SORT_WHITELIST, 'created_at');
    const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = page * pageSize;

    const totalRes = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .query(`SELECT COUNT(*) AS cnt FROM patient_notes WHERE patient_id = @patient_id;`);
    const total = totalRes.recordset[0].cnt;

    if (!total) {
      return {
        data: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: page > 0,
        sortBy: safeSortBy,
        sortDir: dir,
      };
    }

    const query = `
      SELECT id, patient_id, therapist_id, created_by_name, note, created_at
      FROM patient_notes
      WHERE patient_id = @patient_id
      ORDER BY ${safeSortBy} ${dir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const res = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, pageSize)
      .query(query);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: res.recordset,
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page + 1 < totalPages,
      hasPrev: page > 0,
      sortBy: safeSortBy,
      sortDir: dir,
    };
  } catch (error) {
    throw new Error(`Error retrieving patient notes (paginated): ${error.message}`);
  }
}

}

module.exports = PatientDataAccess;
