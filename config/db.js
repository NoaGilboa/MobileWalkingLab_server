const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'noa123456',
    password: process.env.DB_PASS || '123456Noa',
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

console.log('Loaded env config:', {
    DB_SERVER: process.env.DB_SERVER,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS
});


async function connectDB() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to Azure SQL Database!");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'therapists')
            BEGIN
                CREATE TABLE therapists (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    therapist_id NVARCHAR(255) NOT NULL UNIQUE,
                    name NVARCHAR(255) NOT NULL,
                    email NVARCHAR(255) NOT NULL UNIQUE,
                    password NVARCHAR(255) NOT NULL
                );
            END
        `);
        console.log("Checked and created 'therapists' table if not exists");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'patients')
            BEGIN
                CREATE TABLE patients (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    patient_id NVARCHAR(255) NOT NULL UNIQUE,
                    first_name NVARCHAR(255) NOT NULL,
                    last_name NVARCHAR(255) NOT NULL,
                    birth_date DATE NOT NULL,
                    age AS DATEDIFF(YEAR, birth_date, GETDATE()),
                    gender NVARCHAR(50),
                    weight FLOAT,
                    height FLOAT,
                    phone NVARCHAR(20),
                    email NVARCHAR(255),
                    medical_condition NVARCHAR(MAX),
                    mobility_status NVARCHAR(100),
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME
                );
            END
        `);
        console.log("Checked and created 'patients' table if not exists");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'patient_notes')
            BEGIN
                CREATE TABLE patient_notes (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    patient_id INT NOT NULL,
                    therapist_id INT NOT NULL,
                    created_by_name NVARCHAR(255) NOT NULL,
                    note NVARCHAR(MAX),
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
                    FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE
                );
            END
        `);
        console.log("Checked and created 'patient_notes' table if not exists");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'patient_speed_measurements')
            BEGIN
                CREATE TABLE patient_speed_measurements (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    patient_id INT NOT NULL,
                    speed_kmh FLOAT NOT NULL,
                    measured_at DATETIME DEFAULT GETDATE(),
                    source NVARCHAR(50) DEFAULT 'manual',
                    foot_lift_count INT NULL,
                    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
                );
            END
        `);
        console.log("Checked and created 'patient_speed_measurements' table if not exists");


        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'device_measurements')
            BEGIN
                CREATE TABLE device_measurements (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    patient_id INT NOT NULL,
                    measured_at DATETIME DEFAULT GETDATE(),
                    speed FLOAT NOT NULL,
                    distance FLOAT NOT NULL,
                    handPressureL FLOAT NOT NULL,
                    handPressureR FLOAT NOT NULL,
                    footLiftL INT NULL,
                    footLiftR INT NULL,
                    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
                );
            END
        `);
        console.log("Checked and created 'device_measurements' table if not exists");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'patient_videos')
            BEGIN
                CREATE TABLE patient_videos (
                    id INT IDENTITY PRIMARY KEY,
                    patient_id INT NOT NULL,
                    device_measurement_id INT NULL,
                    file_name NVARCHAR(255) NOT NULL,
                    blob_url NVARCHAR(MAX) NOT NULL,
                    uploaded_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (patient_id) REFERENCES patients(id),
                    FOREIGN KEY (device_measurement_id) REFERENCES device_measurements(id) ON DELETE SET NULL
                );
            END
        `);
        console.log("Checked and created 'patient_videos' table if not exists");

        // --- defaults & triggers to keep patients.updated_at always fresh ---

        // 0) default constraint to UTC + backfill for nulls
        await pool.request().query(`
            IF NOT EXISTS (
            SELECT 1
            FROM sys.default_constraints dc
            JOIN sys.columns c ON c.default_object_id = dc.object_id
            JOIN sys.tables  t ON t.object_id = c.object_id
            WHERE t.name = 'patients' AND c.name = 'updated_at'
            )
            BEGIN
            ALTER TABLE dbo.patients
            ADD CONSTRAINT DF_patients_updated_at_utc DEFAULT (GETUTCDATE()) FOR updated_at;
            END;

            UPDATE dbo.patients
            SET updated_at = ISNULL(updated_at, created_at)
            WHERE updated_at IS NULL;
            `);
        console.log("Ensured default & backfilled 'patients.updated_at'");

        // 1) notes -> touch patient
        await pool.request().query(`
            CREATE OR ALTER TRIGGER dbo.trg_touch_patient_on_notes
            ON dbo.patient_notes
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
            SET NOCOUNT ON;

            ;WITH ids AS (
                SELECT patient_id FROM inserted
                UNION
                SELECT patient_id FROM deleted
            )
            UPDATE p
                SET updated_at = GETUTCDATE()
            FROM dbo.patients p
            INNER JOIN (SELECT DISTINCT patient_id FROM ids WHERE patient_id IS NOT NULL) x
                ON x.patient_id = p.id;
            END
            `);
        console.log("Created trigger: trg_touch_patient_on_notes");

        // 2) manual speeds -> touch patient
        await pool.request().query(`
            CREATE OR ALTER TRIGGER dbo.trg_touch_patient_on_manual_speed
            ON dbo.patient_speed_measurements
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
            SET NOCOUNT ON;

            ;WITH ids AS (
                SELECT patient_id FROM inserted
                UNION
                SELECT patient_id FROM deleted
            )
            UPDATE p
                SET updated_at = GETUTCDATE()
            FROM dbo.patients p
            INNER JOIN (SELECT DISTINCT patient_id FROM ids WHERE patient_id IS NOT NULL) x
                ON x.patient_id = p.id;
            END
            `);
        console.log("Created trigger: trg_touch_patient_on_manual_speed");

        // 3) device measurements -> touch patient
        await pool.request().query(`
            CREATE OR ALTER TRIGGER dbo.trg_touch_patient_on_device_meas
            ON dbo.device_measurements
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
            SET NOCOUNT ON;

            ;WITH ids AS (
                SELECT patient_id FROM inserted
                UNION
                SELECT patient_id FROM deleted
            )
            UPDATE p
                SET updated_at = GETUTCDATE()
            FROM dbo.patients p
            INNER JOIN (SELECT DISTINCT patient_id FROM ids WHERE patient_id IS NOT NULL) x
                ON x.patient_id = p.id;
            END
            `);
        console.log("Created trigger: trg_touch_patient_on_device_meas");

        // 4) videos -> touch patient (your schema has patient_id on patient_videos)
        await pool.request().query(`
            CREATE OR ALTER TRIGGER dbo.trg_touch_patient_on_videos
            ON dbo.patient_videos
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
            SET NOCOUNT ON;

            ;WITH ids AS (
                SELECT patient_id FROM inserted
                UNION
                SELECT patient_id FROM deleted
            )
            UPDATE p
                SET updated_at = GETUTCDATE()
            FROM dbo.patients p
            INNER JOIN (SELECT DISTINCT patient_id FROM ids WHERE patient_id IS NOT NULL) x
                ON x.patient_id = p.id;
            END
            `);
        console.log("Created trigger: trg_touch_patient_on_videos");


    } catch (err) {
        console.error("Database connection failed:", err);
    }

}


module.exports = { connectDB, sql };
