// controllers/deviceController.js

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ESP32_BASE_URL = 'http://192.168.1.92'; 

router.get('/start-session', async (req, res) => {
  try {
    const response = await axios.get(`${ESP32_BASE_URL}/start-session`);
    res.json({ message: 'Session started', espResponse: response.data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});


router.get('/stop-session', async (req, res) => {
  try {
    await axios.get(`${ESP32_BASE_URL}/stop-session`);
    const response = await axios.get(`${ESP32_BASE_URL}/data`);

    const data = response.data;

    // כאן תוכלי לשמור למסד נתונים או לעבד את זה
    res.json({ message: 'Session stopped, data retrieved', data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop session or retrieve data' });
  }
});


module.exports = router;