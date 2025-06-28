// controllers/patientController.js

const express = require('express');
const router = express.Router();
const PatientService = require('../services/patientService');


// Get all patients
router.get('/', async (req, res) => {
    try {
        const patients = await PatientService.getAllPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new patient
router.post('/', async (req, res) => {
    try {
        const {
            patient_id, first_name, last_name, birth_date, gender,
            weight, height, phone, email, medical_condition, mobility_status
        } = req.body;

        const success = await PatientService.addPatient({
            patient_id, first_name, last_name, birth_date, gender,
            weight, height, phone, email, medical_condition, mobility_status
        });

        if (success) {
            res.status(201).json({ message: 'Patient created successfully' });
        } else {
            res.status(400).json({ message: 'Failed to create patient' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get details of a specific patient by ID
router.get('/:id', async (req, res) => {
    console.log('Fetching patient by id:', req.params.id);
    try {
        const patient = await PatientService.getPatientById(parseInt(req.params.id));
        if (patient) {
            res.json(patient);
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get notes for a specific patient by userId
router.get('/:id/notes', async (req, res) => {
    try {
        const notes = await PatientService.getNotesByPatientId(parseInt(req.params.id));
        if (notes) {
            res.json(notes);
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a note for a specific patient by ID
router.post('/:id/notes', async (req, res) => {
    try {
        const patientId = parseInt(req.params.id);
        const { therapistId, note } = req.body;
        console.log('Request body:', req.body);
        const success = await PatientService.addNoteToPatient(patientId, therapistId, note);
        if (success) {
            res.status(201).json({ message: 'Note added successfully' });
        } else {
            res.status(404).json({ message: 'Failed to add note' });
        }
    } catch (error) {
        console.log('Request body:', req.body);
        res.status(500).json({ errorr: error.message });
    }
});

// Update patient
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const patientData = req.body;
        const success = await PatientService.updatePatient(id, patientData);
        if (success) {
            res.json({ message: 'Patient updated successfully' });
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete patient
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const success = await PatientService.deletePatient(id);
        if (success) {
            res.json({ message: 'Patient deleted successfully' });
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/patients/:id/notes
router.delete('/:id/notes', async (req, res) => {
    try {
        const success = await PatientService.deleteNotesByPatientId(req.params.id);
        if (success) {
            res.json({ message: 'Notes deleted successfully' });
        } else {
            res.status(404).json({ message: 'No notes found to delete' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// שמירת מדידת מהירות
router.post('/:id/speed', async (req, res) => {
    try {
        const { speed_kmh, source, foot_lift_count } = req.body;
        await PatientService.saveSpeedMeasurement(parseInt(req.params.id), speed_kmh, source, foot_lift_count);
        res.status(201).json({ message: 'Speed measurement saved' });
    } catch (error) {
        console.error("Error saving speed:", error);
        res.status(500).json({ error: error.message });
    }
});

// שליפת היסטוריית מהירויות
router.get('/:id/speed-history', async (req, res) => {
    try {
        const history = await PatientService.getSpeedHistory(parseInt(req.params.id));
        res.json(history);
    } catch (error) {
        console.error("Error fetching speed history:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
