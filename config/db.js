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

const connectDB = async () => {
  try {
    await sql.connect(config);
    console.log('Connected to Azure SQL Database');
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};

module.exports = { connectDB, sql };
