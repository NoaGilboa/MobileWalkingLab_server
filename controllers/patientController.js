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
        const { userId, name, age, condition } = req.body;
        const newPatient = await PatientService.addPatient({userId, name, age, condition });
        res.status(201).json(newPatient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get details of a specific patient by ID
router.get('/:userId', async (req, res) => {
    try {
        const patient = await PatientService.getPatientById(req.params.userId);
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
router.get('/:userId/notes', async (req, res) => {
    try {
          const patientId = req.params.userId;
          const notes = await PatientService.getNotesByPatientId(patientId);
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
router.post('/:userId/notes', async (req, res) => {
    try {
        const { note } = req.body;
        const updatedPatient = await PatientService.addNoteToPatient(req.params.userId, note);
        if (updatedPatient) {
            res.status(201).json({ message: 'Note added successfully', updatedPatient });
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;


// const express = require('express');
// const router = express.Router();
// const PatientService = require('../services/patientService');

// // Get all patients
// router.get('/', (req, res) => {
//   const patients = PatientService.getAllPatients();
//   res.json(patients);
// });

// // Add a new patient
// router.post('/', (req, res) => {
//   const {id, name, age, condition } = req.body;
//   const newPatient = PatientService.addPatient(id, name, age, condition);
//   res.status(201).json(newPatient);
// });

// // Get details of a specific patient by ID
// router.get('/:id', (req, res) => {
//   const patientId = parseInt(req.params.id);
//   const patient = PatientService.getPatientById(patientId);
//   if (patient) {
//     res.json(patient);
//   } else {
//     res.status(404).json({ message: 'Patient not found' });
//   }
// });

// // Get notes for a specific patient by ID
// router.get('/:id/notes', (req, res) => {
//   const patientId = parseInt(req.params.id);
//   const notes = PatientService.getNotesByPatientId(patientId);
//   res.json(notes);
// });

// // Add a note for a specific patient by ID
// router.post('/:id/notes', (req, res) => {
//   const patientId = parseInt(req.params.id);
//   const { note } = req.body;
//   const addedNote = PatientService.addNoteToPatient(patientId, note);
//   res.status(201).json({ message: 'Note added successfully', note: addedNote });
// });

// module.exports = router;
