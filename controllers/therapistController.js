// controllers/therapistController.js

const express = require('express');
const router = express.Router();
const TherapistService = require('../services/therapistService');

// Register a new therapist
router.post('/register', async (req, res) => {
    try {
        const { therapist_id, name, email, password } = req.body;
        const success = await TherapistService.registerTherapist({ therapist_id, name, email, password });
        if (success) {
            res.status(201).json({ message: 'Therapist registered successfully' });
        } else {
            res.status(400).json({ message: 'Registration failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login a therapist
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const therapist = await TherapistService.loginTherapist(email, password);
        if (therapist) {
            res.json({ message: 'Login successful', therapist });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
