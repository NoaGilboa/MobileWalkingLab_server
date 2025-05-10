const sql = require('mssql');

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

async function connectDB() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to Azure SQL Database!");
       
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'therapists')
            BEGIN
                CREATE TABLE therapists (
                    id INT IDENTITY(1,1) PRIMARY KEY,
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
                    userId NVARCHAR(255) NOT NULL UNIQUE,
                    name NVARCHAR(255) NOT NULL,
                    age INT,
                    gender NVARCHAR(50)
                );
            END
        `);
        console.log("Checked and created 'patients' table if not exists");

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'patient_notes')
            BEGIN
                CREATE TABLE patient_notes (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    userId NVARCHAR(255) NOT NULL,
                    note NVARCHAR(MAX),
                    FOREIGN KEY (userId) REFERENCES patients(userId) ON DELETE CASCADE
                );
            END
        `);
        console.log("Checked and created 'patient_notes' table if not exists");

    } catch (err) {
        console.error("Database connection failed:", err);
    }
}


module.exports = { connectDB, sql };
