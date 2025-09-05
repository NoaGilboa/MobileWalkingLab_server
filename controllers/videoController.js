const express = require('express');
const multer = require('multer');
const {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  BlobServiceClient
} = require('@azure/storage-blob');
const sql = require('mssql');
const dbConfig = require('../config/db');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');

const router = express.Router();
const upload = multer(); // Upload in memory

// ---------- Azure Blob setup ----------
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!AZURE_STORAGE_CONNECTION_STRING) {
  console.error('AZURE_STORAGE_CONNECTION_STRING is missing!');
}
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = 'patient-videos';
const containerClient = blobServiceClient.getContainerClient(containerName);

async function ensureContainer() {
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create();
  }
}
ensureContainer();

// ---------- Helpers: Storage credentials / SAS ----------
function getStorageCredsFromEnv() {
  let {
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY,
    AZURE_STORAGE_CONNECTION_STRING
  } = process.env;

  if ((!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) && AZURE_STORAGE_CONNECTION_STRING) {
    const m = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/i);
    if (m) {
      AZURE_STORAGE_ACCOUNT_NAME = m[1];
      AZURE_STORAGE_ACCOUNT_KEY = m[2];
    }
  }
  if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) {
    throw new Error('Storage credentials missing on server');
  }
  return { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY };
}

async function getReadSasForBlob(blobName, ttlSec = 3600) {
  const { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY } = getStorageCredsFromEnv();
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

// ---------- Helpers: SQL fetch ----------
async function getAllByMeasurement(measurementId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool.request()
    .input('device_measurement_id', sql.Int, measurementId)
    .query(`
      SELECT id, patient_id, file_name, blob_url, device_measurement_id, uploaded_at
      FROM patient_videos
      WHERE device_measurement_id = @device_measurement_id
      ORDER BY uploaded_at ASC, id ASC
    `);
  return result.recordset || [];
}

async function getNearestByTime(patientId, t, windowSec) {
  const tMin = new Date(t.getTime() - windowSec * 1000);
  const tMax = new Date(t.getTime() + windowSec * 1000);
  const pool = await sql.connect(dbConfig);
  const result = await pool.request()
    .input('patient_id', sql.Int, patientId)
    .input('tMin', sql.DateTime2, tMin)
    .input('tMax', sql.DateTime2, tMax)
    .input('t',   sql.DateTime2, t)
    .query(`
      SELECT TOP 1 id, patient_id, file_name, blob_url, device_measurement_id, uploaded_at
      FROM patient_videos
      WHERE patient_id = @patient_id
        AND uploaded_at BETWEEN @tMin AND @tMax
      ORDER BY ABS(DATEDIFF(SECOND, uploaded_at, @t)) ASC, uploaded_at DESC, id DESC
    `);
  return result.recordset?.[0] || null;
}

async function getAllSegmentsForSameSessionIfAny(row) {
  // אם יש device_measurement_id — זה האות הקשיח לסשן → נביא את כל הרשומות עבורו
  if (row.device_measurement_id) {
    const segments = await getAllByMeasurement(row.device_measurement_id);
    return segments;
  }
  // אחרת ננסה לזהות לפי תבנית שם הקובץ של הבקר: "<patientId>_<sessionTs>_segmentN.ext"
  // למשל: 2_1735996800_segment1.avi
  const m = String(row.file_name).match(/^(\d+)_(\d+)_segment\d+\.(avi|mov|mp4)$/i);
  if (m) {
    const sessionTs = m[2];
    const pool = await sql.connect(dbConfig);
    const res = await pool.request()
      .input('patient_id', sql.Int, row.patient_id)
      .input('prefix', sql.NVarChar, `${row.patient_id}_${sessionTs}_segment`)
      .query(`
        SELECT id, patient_id, file_name, blob_url, device_measurement_id, uploaded_at
        FROM patient_videos
        WHERE patient_id = @patient_id
          AND file_name LIKE @prefix + '%'
        ORDER BY uploaded_at ASC, id ASC
      `);
    return res.recordset || [];
  }
  // לא זיהינו תבנית – נחזיר רק את הרשומה הבודדת
  return [row];
}

// ---------- FFmpeg streaming: single URL ----------
async function transcodeUrlToMp4Stream(sourceUrl, outFileName, res) {
  // כותרות לתמיכה בניגון דפדפנים
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${outFileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const args = [
    '-hide_banner',
    '-loglevel', 'info',
    '-nostdin',
    // חיבור יציב ל-HTTPS (Azure Blob) במקרה של ניתוק זמני
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_delay_max', '2',
    // קלט
    '-i', sourceUrl,
    // וידאו: H.264 + פרגמנטציה לניגון תוך כדי הורדה
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    // בלי אודיו (אם תרצי אודיו הורידי את -an והוסיפי קידוד אודיו)
    '-an',
    // פלט לצינור HTTP
    '-f', 'mp4',
    '-y',
    'pipe:1'
  ];

  const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let errBuf = '';

  ff.stderr.on('data', d => { errBuf += d.toString(); });

  // מזרים ישירות ל-response
  ff.stdout.pipe(res);

  const kill = () => {
    try { ff.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => { try { ff.kill('SIGKILL'); } catch(_){} }, 5000);
  };
  res.on('close', kill);

  ff.on('error', (e) => {
    console.error('FFmpeg spawn error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'FFmpeg process failed', details: e.message });
  });

  ff.on('close', (code) => {
    if (code !== 0) {
      console.error('FFmpeg exited with code', code, '\n', errBuf);
      // אם עוד לא נשלחו בתים ללקוח – נחזיר שגיאה; אחרת פשוט נסגור את החיבור
      if (!res.headersSent) {
        res.status(500).json({ error: 'Video conversion failed', details: errBuf });
      }
    }
  });
}

// ---------- FFmpeg streaming: multiple URLs concat ----------
async function transcodeMultipleUrlsToMp4Stream(urls, outFileName, res) {
  if (!urls || urls.length === 0) {
    return res.status(400).json({ error: 'No segments to merge' });
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${outFileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // בונים את ארגומנטי הקלט (-i לכל מקור)
  const ffArgs = [
    '-hide_banner', '-loglevel', 'info', '-nostdin',
    '-reconnect', '1', '-reconnect_streamed', '1',
    '-reconnect_at_eof', '1', '-reconnect_delay_max', '2'
  ];
  urls.forEach(u => { ffArgs.push('-i', u); });

  // בונים filter_complex ל־concat
  // לדוגמה עבור N=3: "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]"
  const n = urls.length;
  const inputs = Array.from({ length: n }, (_, i) => `[${i}:v]`).join('');
  const filter = `${inputs}concat=n=${n}:v=1:a=0[v]`;

  ffArgs.push(
    '-filter_complex', filter,
    '-map', '[v]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    '-an',
    '-y',
    'pipe:1'
  );

  const ff = spawn(ffmpegPath, ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  let errBuf = '';

  ff.stderr.on('data', d => { errBuf += d.toString(); });
  ff.stdout.pipe(res);

  const kill = () => { try { ff.kill('SIGTERM'); } catch (_) {} setTimeout(() => { try { ff.kill('SIGKILL'); } catch(_){} }, 5000); };
  res.on('close', kill);

  ff.on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ error: 'FFmpeg concat failed', details: e.message });
  });
  ff.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).json({ error: 'Video concat failed', details: errBuf });
    }
  });
}

// ---------- Upload video for a patient ----------
router.post('/:id/upload-video', upload.single('video'), async (req, res) => {
  await ensureContainer();
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

// ---------- JSON: Get by measurement (single or merged) ----------
router.get('/by-measurement/:measurementId', async (req, res) => {
  try {
    const measurementId = parseInt(req.params.measurementId);
    const rows = await getAllByMeasurement(measurementId);

    if (!rows.length) return res.status(404).json({ error: 'No video found for this measurement' });

    if (rows.length === 1) {
      // קטע יחיד → נחזיר SAS לינק רגיל + לינק סטרים MP4 אופציונלי
      const fileName = rows[0].file_name;
      const sasUrl = await getReadSasForBlob(fileName, 24 * 3600);
      const outName = fileName.replace(/\.(avi|mov)$/i, '.mp4');
      return res.json({
        type: 'single',
        file_name: fileName,
        blob_url: sasUrl,
        mp4_stream_url: `/api/video/stream/by-file/${encodeURIComponent(fileName)}.mp4`
      });
    }

    // כמה מקטעים → נחזיר URL סטרים מאוחד
    return res.json({
      type: 'merged',
      combined_stream_url: `/api/video/stream/by-measurement/${measurementId}.mp4`,
      count: rows.length
    });
  } catch (err) {
    console.error('by-measurement error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ---------- JSON: Get by time (single or merged) ----------
router.get('/by-time', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId);
    const t = new Date(req.query.t);
    const windowSec = parseInt(req.query.windowSec || '900');

    if (!patientId || isNaN(t.getTime())) {
      return res.status(400).json({ error: 'patientId/t required' });
    }

    const nearest = await getNearestByTime(patientId, t, windowSec);
    if (!nearest) return res.status(404).json({ error: 'No video near that time' });

    // השג את כל המקטעים של אותו סשן (אם יש)
    const segments = await getAllSegmentsForSameSessionIfAny(nearest);

    if (segments.length <= 1) {
      const fileName = nearest.file_name;
      const sasUrl = await getReadSasForBlob(fileName, 24 * 3600);
      return res.json({
        type: 'single',
        file_name: fileName,
        blob_url: sasUrl,
        mp4_stream_url: `/api/video/stream/by-file/${encodeURIComponent(fileName)}.mp4`
      });
    }

    // יש כמה מקטעים → סטרימינג מאוחד לפי זמן
    return res.json({
      type: 'merged',
      combined_stream_url: `/api/video/stream/by-time.mp4?patientId=${patientId}&t=${encodeURIComponent(t.toISOString())}&windowSec=${windowSec}`,
      count: segments.length
    });

  } catch (err) {
    console.error('by-time error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ---------- List all videos for a patient ----------
router.get('/:id/videos', async (req, res) => {
  const patientId = parseInt(req.params.id);
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .query(`
        SELECT id, file_name, blob_url, uploaded_at, device_measurement_id
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

// ---------- STREAM: single file name → MP4 (on-the-fly) ----------
router.get('/stream/by-file/:encodedFileName.mp4', async (req, res) => {
  try {
    const encoded = req.params.encodedFileName; // כאן זה ה־file_name המקורי כשהוא מוצפן ל-URL
    const file_name = decodeURIComponent(encoded);
    const sourceUrl = await getReadSasForBlob(file_name, 3600);

    const base = path.basename(file_name);
    const outName = base.replace(/\.(avi|mov)$/i, '.mp4');
    await transcodeUrlToMp4Stream(sourceUrl, outName, res);
  } catch (err) {
    console.error('stream by-file error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ---------- STREAM: concat by measurement → MP4 ----------
router.get('/stream/by-measurement/:measurementId.mp4', async (req, res) => {
  try {
    const measurementId = parseInt(req.params.measurementId);
    const rows = await getAllByMeasurement(measurementId);
    if (!rows.length) return res.status(404).json({ error: 'No video found' });

    if (rows.length === 1) {
      // קטע יחיד – אם בכל זאת פנו לנתיב קונקט נחזיר פשוט סטרים MP4 שלו
      const fileName = rows[0].file_name;
      const sourceUrl = await getReadSasForBlob(fileName, 3600);
      const outName = path.basename(fileName).replace(/\.(avi|mov)$/i, '.mp4');
      return transcodeUrlToMp4Stream(sourceUrl, outName, res);
    }

    const urls = await Promise.all(rows.map(r => getReadSasForBlob(r.file_name, 3600)));
    const outName = `measurement_${measurementId}.mp4`;
    await transcodeMultipleUrlsToMp4Stream(urls, outName, res);
  } catch (err) {
    console.error('concat by-measurement error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ---------- STREAM: concat by time → MP4 ----------
router.get('/stream/by-time.mp4', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId);
    const t = new Date(req.query.t);
    const windowSec = parseInt(req.query.windowSec || '900');

    if (!patientId || isNaN(t.getTime())) {
      return res.status(400).json({ error: 'patientId/t required' });
    }

    const nearest = await getNearestByTime(patientId, t, windowSec);
    if (!nearest) return res.status(404).json({ error: 'No video near that time' });

    const segments = await getAllSegmentsForSameSessionIfAny(nearest);
    if (!segments.length) return res.status(404).json({ error: 'No segments found' });

    if (segments.length === 1) {
      const fileName = segments[0].file_name;
      const sourceUrl = await getReadSasForBlob(fileName, 3600);
      const outName = path.basename(fileName).replace(/\.(avi|mov)$/i, '.mp4');
      return transcodeUrlToMp4Stream(sourceUrl, outName, res);
    }

    const urls = await Promise.all(segments.map(r => getReadSasForBlob(r.file_name, 3600)));
    const outName = `patient_${patientId}_combined.mp4`;
    await transcodeMultipleUrlsToMp4Stream(urls, outName, res);
  } catch (err) {
    console.error('concat by-time error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal error' });
  }
});

module.exports = router;
