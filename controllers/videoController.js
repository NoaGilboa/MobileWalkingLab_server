const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const dbConfig = require('../config/db');

const router = express.Router();
const upload = multer(); // Upload in memory

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'patient-videos';
const containerClient = blobServiceClient.getContainerClient(containerName);
const { generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, StorageSharedKeyCredential } = require('@azure/storage-blob');

// Ensure container exists
async function ensureContainer() {
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create();
  }
}
ensureContainer();

// Upload video for a patient
router.post('/:id/upload-video', upload.single('video'), async (req, res) => {
  const patientId = parseInt(req.params.id);
  const file = req.file;
  const { device_measurement_id } = req.body;

  if (!file) return res.status(400).json({ error: 'No video file provided' });

  const fileName = `${patientId}_${Date.now()}_${file.originalname}`;

  try {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(file.buffer);

    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('patient_id', sql.Int, patientId)
      .input('file_name', sql.NVarChar, fileName)
      .input('blob_url', sql.NVarChar, blockBlobClient.url)
      .input('device_measurement_id', sql.Int, device_measurement_id || null) 
      .query(`
        INSERT INTO patient_videos (patient_id, file_name, blob_url, device_measurement_id)
        VALUES (@patient_id, @file_name, @blob_url, @device_measurement_id)
      `);

    res.status(201).json({ message: 'Video uploaded successfully', url: blockBlobClient.url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get video by device measurement ID
router.get('/by-measurement/:measurementId', async (req, res) => {
  const measurementId = parseInt(req.params.measurementId);

  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('device_measurement_id', sql.Int, measurementId)
      .query(`
        SELECT TOP 1 * FROM patient_videos
        WHERE device_measurement_id = @device_measurement_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video found for this measurement' });
    }

    const video = result.recordset[0];

    // ⚙️ פרטי חשבון ואחסון מתוך משתני סביבה
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(video.file_name);

    // 🎟️ יצירת SAS URL תקף עד 31.12.2030
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName: video.file_name,
      permissions: BlobSASPermissions.parse('r'), // read only
      protocol: SASProtocol.Https,
      startsOn: new Date(),
      expiresOn: new Date('2030-12-31T23:59:59Z')
    }, sharedKeyCredential).toString();

    const sasUrl = `${blobClient.url}?${sasToken}`;

    // שליחת כתובת עם SAS
    res.json({
      ...video,
      blob_url: sasUrl
    });

  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 📥 Get list of videos for a patient
router.get('/:id/videos', async (req, res) => {
  const patientId = parseInt(req.params.id);

  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .query(`
        SELECT id, file_name, blob_url, uploaded_at
        FROM patient_videos
        WHERE patient_id = @patient_id
        ORDER BY uploaded_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
