const express = require('express');
const multer = require('multer');
const { generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, StorageSharedKeyCredential, BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const dbConfig = require('../config/db');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fetch = require('node-fetch');

const router = express.Router();
const upload = multer();

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

    let sharedKeyCredential;
    try {
      const { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY } = getAzureCredentials();
      sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
    } catch (err) {
      console.error('Storage credentials error:', err.message);
      return res.status(500).json({ error: 'Storage credentials missing on server' });
    }

    const blobClient = blobServiceClient
      .getContainerClient(containerName)
      .getBlobClient(video.file_name);

    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
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
    const windowSec = parseInt(req.query.windowSec || '900');

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

    const { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY } = getAzureCredentials();
    const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
    const blobClient = blobServiceClient.getContainerClient(containerName).getBlobClient(video.file_name);

    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
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


// Get list of videos for a patient
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

function getAzureCredentials() {
  let { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY, AZURE_STORAGE_CONNECTION_STRING } = process.env;
  
  if ((!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) && AZURE_STORAGE_CONNECTION_STRING) {
    const m = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+);.*AccountKey=([^;]+)/i);
    if (m) {
      AZURE_STORAGE_ACCOUNT_NAME = m[1];
      AZURE_STORAGE_ACCOUNT_KEY = m[2];
    }
  }
  
  if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) {
    throw new Error('Storage credentials missing');
  }
  
  return { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY };
}

async function getReadSasForBlob(blobName, ttlSec = 3600) {
  const { AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY } = getAzureCredentials();
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

// Enhanced video transcoding function with better debugging
async function transcodeUrlToMp4Stream(aviUrl, outFileName, res) {
  console.log('Starting transcode for:', aviUrl);
  
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${outFileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // First, check if the URL is accessible
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

  // Enhanced ffmpeg settings
  const args = [
    '-hide_banner', 
    '-loglevel', 'info',
    '-i', aviUrl,
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

  // Cleanup when client disconnects
  res.on('close', () => {
    console.log('Client disconnected, killing FFmpeg process');
    ff.kill('SIGTERM');
    setTimeout(() => {
      ff.kill('SIGKILL');
    }, 5000);
  });
}



router.get('/stream/by-time.mp4', async (req, res) => {
  try {
    const patientId = parseInt(req.query.patientId);
    const t = new Date(req.query.t);
    const windowSec = parseInt(req.query.windowSec || '900');
    
    if (!patientId || isNaN(t.getTime())) {
      return res.status(400).json({ error: 'patientId/t required' });
    }
    
    const tMin = new Date(t.getTime() - windowSec * 1000);
    const tMax = new Date(t.getTime() + windowSec * 1000);

    const pool = await sql.connect(dbConfig);
    
    // First find measurement ID
    const measurementResult = await pool.request()
      .input('patient_id', sql.Int, patientId)
      .input('tMin', sql.DateTime2, tMin)
      .input('tMax', sql.DateTime2, tMax)
      .input('t', sql.DateTime2, t)
      .query(`
        SELECT TOP 1 device_measurement_id
        FROM patient_videos
        WHERE patient_id = @patient_id
          AND uploaded_at BETWEEN @tMin AND @tMax
          AND device_measurement_id IS NOT NULL
        ORDER BY ABS(DATEDIFF(SECOND, uploaded_at, @t)) ASC
      `);

    if (measurementResult.recordset.length === 0) {
      return res.status(404).json({ error: 'No video near that time' });
    }

    const measurementId = measurementResult.recordset[0].device_measurement_id;
    
    // Now get all segments of that measurement
    const segmentsResult = await pool.request()
      .input('device_measurement_id', sql.Int, measurementId)
      .query(`
        SELECT file_name, uploaded_at
        FROM patient_videos
        WHERE device_measurement_id = @device_measurement_id
        ORDER BY uploaded_at ASC, id ASC
      `);

    const segments = segmentsResult.recordset;
    console.log(`Processing ${segments.length} segments for measurement ${measurementId} (time-based query)`);

    if (segments.length === 1) {
      // Single segment - supports all formats
      const aviUrl = await getReadSasForBlob(segments[0].file_name, 3600);
      const outName = segments[0].file_name.replace(/\.(avi|mov|mp4)$/i, '.mp4');
      return transcodeUrlToMp4Stream(aviUrl, outName, res);
    } else {
      // Multiple segments - merge to full video
      return concatenateAndStreamMp4(segments, measurementId, res);
    }
    
  } catch (err) {
    console.error('stream by-time error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
});




async function concatenateAndStreamMp4(segments, measurementId, res) {
  console.log(`Concatenating ${segments.length} segments for measurement ${measurementId}`);

  const tempDir = require('os').tmpdir();
  const path = require('path');
  const fs = require('fs').promises;
  
  const concatListPath = path.join(tempDir, `concat_${measurementId}_${Date.now()}.txt`);
  const tempFiles = [];

  try {
    // Download all segments
    for (let i = 0; i < segments.length; i++) {
      const segmentUrl = await getReadSasForBlob(segments[i].file_name, 3600);
      const tempFile = path.join(tempDir, `segment_${measurementId}_${i}.avi`);
      
      const response = await fetch(segmentUrl);
      if (!response.ok) {
        throw new Error(`Failed to download segment ${i}: ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      await fs.writeFile(tempFile, buffer);
      tempFiles.push(tempFile);
      
      console.log(`Downloaded segment ${i + 1}/${segments.length} (${buffer.length} bytes)`);
    }
    
    // Create concat list
    const concatList = tempFiles.map(file => `file '${file}'`).join('\n');
    await fs.writeFile(concatListPath, concatList);
    
    console.log('Starting FFmpeg concatenation and conversion to MP4...');
    
    // Set headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="measurement_${measurementId}_complete.mp4"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Run FFmpeg with direct pipe
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-f', 'mp4',
      '-an',
      '-y',
      'pipe:1'
    ];

    const ff = spawn(ffmpegPath, args);
    ff.stdout.pipe(res);

    ff.on('close', async (code) => {
      console.log(`FFmpeg concatenation finished with code: ${code}`);
      
      // Clean up temporary files
      await fs.unlink(concatListPath).catch(() => {});
      for (const tempFile of tempFiles) {
        await fs.unlink(tempFile).catch(() => {});
      }

      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: 'Video concatenation failed' });
      }
    });

    ff.on('error', async (err) => {
      console.error('FFmpeg concatenation error:', err);
      
      // Clean up temporary files
      await fs.unlink(concatListPath).catch(() => {});
      for (const tempFile of tempFiles) {
        await fs.unlink(tempFile).catch(() => {});
      }

      if (!res.headersSent) {
        res.status(500).json({ error: 'Video concatenation process failed' });
      }
    });

    res.on('close', () => {
      ff.kill('SIGTERM');
    });

  } catch (err) {
    console.error('Concatenation setup error:', err);
    
    // Clean up on error
    await fs.unlink(concatListPath).catch(() => {});
    for (const tempFile of tempFiles) {
      await fs.unlink(tempFile).catch(() => {});
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}


// STREAM BY MEASUREMENT → MP4 (updated for full video)
router.get('/stream/by-measurement/:measurementId.mp4', async (req, res) => {
  try {
    const measurementId = parseInt(req.params.measurementId);
    
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('device_measurement_id', sql.Int, measurementId)
      .query(`
        SELECT file_name, uploaded_at
        FROM patient_videos
        WHERE device_measurement_id = @device_measurement_id
        ORDER BY uploaded_at ASC, id ASC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No video found' });
    }

    const segments = result.recordset;
    console.log(`Processing ${segments.length} segments for measurement ${measurementId}`);

    if (segments.length === 1) {
      // Single segment - regular conversion (also supports older formats)
      const aviUrl = await getReadSasForBlob(segments[0].file_name, 3600);
      const outName = segments[0].file_name.replace(/\.(avi|mov|mp4)$/i, '.mp4');
      return transcodeUrlToMp4Stream(aviUrl, outName, res);
    } else {
      // Multiple segments - merge to full video
      return concatenateAndStreamMp4(segments, measurementId, res);
    }
    
  } catch (err) {
    console.error('stream by-measurement error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
});

module.exports = router;
