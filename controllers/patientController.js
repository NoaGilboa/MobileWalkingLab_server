// controllers/patientController.js

const express = require('express');
const router = express.Router();
const PatientService = require('../services/patientService');
const OpenAIService = require('../services/openAIService');
const DeviceService = require('../services/deviceService');


// Get all patients
router.get('/', async (req, res) => {
  try {
    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined  ||
                      (req.query.qName || req.query.qId); ;

    if (!hasPaging) {
      const patients = await PatientService.getAllPatients();
      return res.json(patients);
    }

    const { page, pageSize, sortBy, sortDir } = parsePaging(req, {
      defaultPageSize: 20,
      maxPageSize: 100,
      defaultSortBy: 'id',
      defaultSortDir: 'ASC',
    });
    const qName = (req.query.qName || '').trim();
    const qId   = (req.query.qId || '').trim();

    const result = await PatientService.getAllPatientsPaginated({ page, pageSize, sortBy, sortDir, qName, qId });

    const baseUrl = req.baseUrl || '/api/patients';
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortDir });
    const links = [];
    if (page > 0) {
      const prevQ = new URLSearchParams(q); prevQ.set('page', String(page - 1));
      links.push(`<${baseUrl}?${prevQ.toString()}>; rel="prev"`);
    }
    if ((page + 1) * pageSize < result.total) {
      const nextQ = new URLSearchParams(q); nextQ.set('page', String(page + 1));
      links.push(`<${baseUrl}?${nextQ.toString()}>; rel="next"`);
    }
    if (links.length) res.set('Link', links.join(', '));

    return res.json(result); 
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

router.post('/:id/treatment-recommendation', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);

    const patient = await PatientService.getPatientById(patientId);
    const notes = await PatientService.getNotesByPatientId(patientId);
    const speedHistory = await PatientService.getSpeedHistory(patientId);
    const espHistory = await DeviceService.getDeviceMeasurements(patientId, [
      'speed', 'distance',
      'handPressureL', 'handPressureR',
      'footLiftL', 'footLiftR'
    ]);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    try {
      const recommendation = await OpenAIService.getTreatmentRecommendation({
        birth_date: patient.birth_date,
        gender: patient.gender,
        weight: patient.weight,
        height: patient.height,
        medical_condition: patient.medical_condition,
        mobility_status: patient.mobility_status,
        notes: notes.map(n => n.note),
        speedHistory,
        espHistory
      });

      if (recommendation) {
        res.json({ recommendation });
      } else {
        res.status(500).json({ message: 'No recommendation generated' });
      }

    } catch (error) {
      res.status(500).json({ error: error.message });
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


// Get notes for a specific patient by userId
router.get('/:id/notes', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient id' });
    }

    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined;

    if (!hasPaging) {
      const notes = await PatientService.getNotesByPatientId(patientId);
      return notes ? res.json(notes) : res.status(404).json({ message: 'Patient not found' });
    }

    const { page, pageSize, sortBy, sortDir } = parsePaging(req, {
      defaultPageSize: 20,
      maxPageSize: 100,
      defaultSortBy: 'created_at',
      defaultSortDir: 'DESC',
    });

    const result = await PatientService.getNotesByPatientIdPaginated(patientId, { page, pageSize, sortBy, sortDir });

    // Link headers
    const baseUrl = `${req.baseUrl}/${patientId}/notes`; // /api/patients/:id/notes
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortDir });
    const links = [];
    if (page > 0) {
      const prevQ = new URLSearchParams(q); prevQ.set('page', String(page - 1));
      links.push(`<${baseUrl}?${prevQ.toString()}>; rel="prev"`);
    }
    if ((page + 1) * pageSize < result.total) {
      const nextQ = new URLSearchParams(q); nextQ.set('page', String(page + 1));
      links.push(`<${baseUrl}?${nextQ.toString()}>; rel="next"`);
    }
    if (links.length) res.set('Link', links.join(', '));

    return res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


function parsePaging(req, { defaultPageSize = 4, maxPageSize = 10, defaultSortBy = 'id', defaultSortDir = 'ASC' } = {}) {
  const page = Math.max(parseInt(req.query.page || '0', 10), 0);
  let pageSize = parseInt(req.query.pageSize || String(defaultPageSize), 10);
  if (Number.isNaN(pageSize) || pageSize <= 0) pageSize = defaultPageSize;
  pageSize = Math.min(pageSize, maxPageSize);

  const sortBy = (req.query.sortBy || defaultSortBy).toString();
  const sortDir = (req.query.sortDir || defaultSortDir).toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  return { page, pageSize, sortBy, sortDir };
}

module.exports = router;
