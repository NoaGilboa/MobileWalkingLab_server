const express = require('express');
const multer = require('multer');
const { generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, StorageSharedKeyCredential, BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const dbConfig = require('../config/db');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const router = express.Router();
const upload = multer(); // Upload in memory

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'patient-videos';
const containerClient = blobServiceClient.getContainerClient(containerName);

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
        SELECT TOP 1 id, patient_id, file_name, blob_url, device_measurement_id, uploaded_at
        FROM patient_videos
        WHERE device_measurement_id = @device_measurement_id
        ORDER BY uploaded_at DESC, id DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video found for this measurement' });
    }

    const video = result.recordset[0];

    // ---- credentials with fallback + logging ----
    let { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONNECTION_STRING } = process.env;

    if ((!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) && AZURE_STORAGE_CONNECTION_STRING) {
      const m = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/i);
      if (m) {
        AZURE_STORAGE_ACCOUNT_NAME = m[1];
        AZURE_STORAGE_ACCOUNT_KEY = m[2];
      }
    }
    if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) {
      console.error('Storage credentials missing. name?', !!AZURE_STORAGE_ACCOUNT_NAME, 'key?', !!AZURE_STORAGE_ACCOUNT_KEY);
      return res.status(500).json({ error: 'Storage credentials missing on server' });
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(
      AZURE_STORAGE_ACCOUNT_NAME,
      AZURE_STORAGE_ACCOUNT_KEY
    );

    const blobClient = blobServiceClient
      .getContainerClient(containerName)
      .getBlobClient(video.file_name);

    // ---- clock skew buffer ----
    const startsOn = new Date(Date.now() - 5 * 60 * 1000); // 5 דק' אחורה
    const expiresOn = new Date('2030-12-31T23:59:59Z');

    let sasToken;
    try {
      sasToken = generateBlobSASQueryParameters({
        containerName,
        blobName: video.file_name,
        permissions: BlobSASPermissions.parse('r'),
        protocol: SASProtocol.Https,
        startsOn,
        expiresOn
      }, sharedKeyCredential).toString();
    } catch (e) {
      console.error('SAS generation error:', e?.message, e?.stack);
      return res.status(500).json({ error: 'Failed to generate SAS URL' });
    }

    return res.json({ ...video, blob_url: `${blobClient.url}?${sasToken}` });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /video/by-time?patientId=2&t=2025-08-30T15:46:00.000Z&windowSec=900
router.get('/by-time', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId);
    const t = new Date(req.query.t);
    const windowSec = parseInt(req.query.windowSec || '900'); // ברירת מחדל 15 דק'

    if (!patientId || isNaN(t.getTime())) {
      return res.status(400).json({ error: 'patientId/t required' });
    }

    const tMin = new Date(t.getTime() - windowSec * 1000);
    const tMax = new Date(t.getTime() + windowSec * 1000);

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .input('tMin', sql.DateTime2, tMin)
      .input('tMax', sql.DateTime2, tMax)
      .input('t', sql.DateTime2, t) 
      .query(`
        SELECT TOP 1 id, patient_id, file_name, blob_url, device_measurement_id, uploaded_at
        FROM patient_videos
        WHERE patient_id = @patient_id
          AND uploaded_at BETWEEN @tMin AND @tMax
        ORDER BY ABS(DATEDIFF(SECOND, uploaded_at, @t)) ASC, uploaded_at DESC, id DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video near that time' });
    }

    const video = result.recordset[0];

    // צור SAS URL לקריאה
    let { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONNECTION_STRING } = process.env;
    if ((!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) && AZURE_STORAGE_CONNECTION_STRING) {
      const m = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/i);
      if (m) { AZURE_STORAGE_ACCOUNT_NAME = m[1]; AZURE_STORAGE_ACCOUNT_KEY = m[2]; }
    }
    const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
    const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(video.file_name);

    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName: video.file_name,
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      startsOn,
      expiresOn
    }, sharedKeyCredential).toString();

    res.json({ ...video, blob_url: `${blobClient.url}?${sasToken}` });
  } catch (err) {
    console.error('by-time error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
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

async function getReadSasForBlob(blobName, ttlSec = 3600) {
  let { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONNECTION_STRING } = process.env;
  if ((!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) && AZURE_STORAGE_CONNECTION_STRING) {
    const m = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/i);
    if (m) { AZURE_STORAGE_ACCOUNT_NAME = m[1]; AZURE_STORAGE_ACCOUNT_KEY = m[2]; }
  }
  const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + ttlSec * 1000);
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    protocol: SASProtocol.Https,
    startsOn,
    expiresOn
  }, sharedKeyCredential).toString();
  const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(blobName);
  return `${blobClient.url}?${sas}`;
}

async function transcodeUrlToMp4Stream(aviUrl, outFileName, res) {
  console.log('Starting transcode for:', aviUrl);
  
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${outFileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ראשית, בואו נבדוק שה-URL נגיש
  try {
    const testResponse = await fetch(aviUrl, { method: 'HEAD' });
    if (!testResponse.ok) {
      console.error('Source URL not accessible:', testResponse.status);
      return res.status(500).json({ error: 'Source video not accessible' });
    }
    console.log('Source URL accessible, content-length:', testResponse.headers.get('content-length'));
  } catch (err) {
    console.error('Error testing source URL:', err);
    return res.status(500).json({ error: 'Cannot access source video' });
  }

  // הגדרות ffmpeg משופרות
  const args = [
    '-hide_banner', 
    '-loglevel', 'info', // שנה ל-info כדי לראות יותר פרטים
    '-i', aviUrl,
    '-c:v', 'libx264',
    '-preset', 'ultrafast', // מהיר יותר מ-veryfast
    '-crf', '28', // איכות קצת יותר נמוכה למהירות
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline', // פרופיל בסיסי לתאימות טובה יותר
    '-level', '3.0',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof', // שיפור לסטרימינג
    '-f', 'mp4',
    '-an', // ללא אודיו
    '-y', // overwrite
    'pipe:1'
  ];

  console.log('FFmpeg command:', ffmpegPath, args.join(' '));

  const ff = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let errorOutput = '';

  ff.stderr.on('data', (data) => {
    const output = data.toString();
    errorOutput += output;
    console.log('FFmpeg stderr:', output);
  });

  ff.stdout.on('data', (chunk) => {
    console.log('FFmpeg output chunk size:', chunk.length);
  });

  ff.stdout.pipe(res);

  ff.on('close', (code) => {
    console.log('FFmpeg process closed with code:', code);
    if (code !== 0) {
      console.error('FFmpeg stderr output:', errorOutput);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Video conversion failed', details: errorOutput });
      }
    }
  });

  ff.on('error', (err) => {
    console.error('FFmpeg process error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'FFmpeg process failed', details: err.message });
    }
  });

  // ניקוי כשהלקוח מתנתק
  res.on('close', () => {
    console.log('Client disconnected, killing FFmpeg process');
    ff.kill('SIGTERM');
    setTimeout(() => {
      ff.kill('SIGKILL');
    }, 5000);
  });
}

// פונקציה חלופית - המרה דרך temp file (אם הסטרימינג לא עובד)
async function transcodeToTempMp4(aviUrl, outFileName, res) {
  const tempDir = require('os').tmpdir();
  const path = require('path');
  const fs = require('fs').promises;
  
  const tempInput = path.join(tempDir, `temp_input_${Date.now()}.avi`);
  const tempOutput = path.join(tempDir, `temp_output_${Date.now()}.mp4`);

  try {
    // הורד את הקובץ המקור לtemp
    console.log('Downloading source file...');
    const response = await fetch(aviUrl);
    if (!response.ok) throw new Error('Failed to fetch source');
    
    const buffer = await response.buffer();
    await fs.writeFile(tempInput, buffer);
    console.log('Source downloaded to temp:', tempInput);

    // המר באמצעות ffmpeg
    const args = [
      '-hide_banner',
      '-loglevel', 'info',
      '-i', tempInput,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-movflags', '+faststart',
      '-an',
      '-y',
      tempOutput
    ];

    console.log('Running FFmpeg conversion...');
    
    const ff = spawn(ffmpegPath, args);
    
    ff.stderr.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });

    await new Promise((resolve, reject) => {
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      ff.on('error', reject);
    });

    // שלח את הקובץ המומר
    const convertedBuffer = await fs.readFile(tempOutput);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="${outFileName}"`);
    res.setHeader('Content-Length', convertedBuffer.length);
    res.send(convertedBuffer);

    // נקה temp files
    await fs.unlink(tempInput).catch(() => {});
    await fs.unlink(tempOutput).catch(() => {});

  } catch (err) {
    console.error('Temp conversion error:', err);
    
    // נקה temp files במקרה של שגיאה
    await fs.unlink(tempInput).catch(() => {});
    await fs.unlink(tempOutput).catch(() => {});
    
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

// endpoints משופרים
router.get('/stream/by-measurement/:measurementId.mp4', async (req, res) => {
  try {
    const measurementId = parseInt(req.params.measurementId);
    const useTemp = req.query.temp === 'true'; // להוסיף ?temp=true לבדיקה
    
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('device_measurement_id', sql.Int, measurementId)
      .query(`
        SELECT TOP 1 file_name, uploaded_at
        FROM patient_videos
        WHERE device_measurement_id = @device_measurement_id
        ORDER BY uploaded_at DESC, id DESC
      `);
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video found' });
    }

    const { file_name } = result.recordset[0];
    const aviUrl = await getReadSasForBlob(file_name, 3600);
    const outName = file_name.replace(/\.avi$/i, '.mp4');
    
    console.log('Processing video:', { file_name, aviUrl: aviUrl.substring(0, 100) + '...' });
    
    if (useTemp) {
      await transcodeToTempMp4(aviUrl, outName, res);
    } else {
      await transcodeUrlToMp4Stream(aviUrl, outName, res);
    }
    
  } catch (err) {
    console.error('Stream by-measurement error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
});

router.get('/stream/by-time.mp4', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId);
    const t = new Date(req.query.t);
    const windowSec = parseInt(req.query.windowSec || '900');
    const useTemp = req.query.temp === 'true';
    
    if (!patientId || isNaN(t.getTime())) {
      return res.status(400).json({ error: 'patientId/t required' });
    }
    
    const tMin = new Date(t.getTime() - windowSec * 1000);
    const tMax = new Date(t.getTime() + windowSec * 1000);

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .input('tMin', sql.DateTime2, tMin)
      .input('tMax', sql.DateTime2, tMax)
      .input('t', sql.DateTime2, t)
      .query(`
        SELECT TOP 1 file_name, uploaded_at
        FROM patient_videos
        WHERE patient_id = @patient_id
          AND uploaded_at BETWEEN @tMin AND @tMax
        ORDER BY ABS(DATEDIFF(SECOND, uploaded_at, @t)) ASC, uploaded_at DESC, id DESC
      `);
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video near that time' });
    }

    const { file_name } = result.recordset[0];
    const aviUrl = await getReadSasForBlob(file_name, 3600);
    const outName = file_name.replace(/\.avi$/i, '.mp4');
    
    if (useTemp) {
      await transcodeToTempMp4(aviUrl, outName, res);
    } else {
      await transcodeUrlToMp4Stream(aviUrl, outName, res);
    }
    
  } catch (err) {
    console.error('Stream by-time error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
});

module.exports = router;