// controllers/deviceController.js

const express = require('express');
const axios = require('axios');
const router = express.Router();
let currentCommand = {
  command: 'idle',
  patientId: null
};
const DeviceService = require('../services/deviceService');

router.get('/command', (req, res) => {
  res.json({ command: currentCommand });
});

router.post('/command', (req, res) => {
  const { command, patientId } = req.body;

  if (!['start', 'stop', 'idle'].includes(command)) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  currentCommand = { command, patientId };
  console.log(`🔁 Command updated:`, currentCommand);
  res.json({ message: 'Command updated successfully' });
});

//get measurements from esp32 and save measurements at db
router.post('/:id/data', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const measurements = req.body;
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return res.status(400).json({ error: 'No measurements provided' });
    }
    const raw = await DeviceService.saveDeviceMeasurements(patientId, measurements)
    res.json({ message: 'Measurements received', count: measurements.length });
  } catch (error) {
    console.error("❌ Error fetching device measurements:", error);
    res.status(500).json({ error: error.message });
  }
});

//get all measurements from db
router.get('/:id/measurements', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const raw = await DeviceService.getFieldHistory(patientId, [
      'speed', 'distance',
      'handPressureL', 'handPressureR',
      'footLiftL', 'footLiftR'
    ]);

    const grouped = {
      speed: [],
      distance: [],
      handPressureL: [],
      handPressureR: [],
      footLiftL: [],
      footLiftR: []
    };

    raw.forEach(entry => {
      const time = entry.measured_at;
      if (entry.speed != null) grouped.speed.push({ value: entry.speed, measured_at: time });
      if (entry.distance != null) grouped.distance.push({ value: entry.distance, measured_at: time });
      if (entry.handPressureL != null) grouped.handPressureL.push({ value: entry.handPressureL, measured_at: time });
      if (entry.handPressureR != null) grouped.handPressureR.push({ value: entry.handPressureR, measured_at: time });
      if (entry.footLiftL != null) grouped.footLiftL.push({ value: entry.footLiftL, measured_at: time });
      if (entry.footLiftR != null) grouped.footLiftR.push({ value: entry.footLiftR, measured_at: time });
    });

    res.json(grouped);
  } catch (error) {
    console.error("❌ Error fetching device measurements:", error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;