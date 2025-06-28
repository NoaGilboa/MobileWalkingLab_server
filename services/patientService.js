// services/patientService.js

const PatientDataAccess = require('../dataAccess/patientDataAccess');

class PatientService {
    static async getAllPatients() {
        return await PatientDataAccess.getAllPatients();
    }

    static async addPatient(patientData) {
        return await PatientDataAccess.addPatient(patientData);
    }

    static async getPatientById(id) {
        return await PatientDataAccess.getPatientById(id);
    }

    static async getNotesByPatientId(patientId) {
        return await PatientDataAccess.getNotesByPatientId(patientId);
    }

    static async addNoteToPatient(patientId, therapistId, note) {
        return await PatientDataAccess.addNoteToPatient(patientId, therapistId, note);
    }

    static async updatePatient(id, patientData) {
        return await PatientDataAccess.updatePatient(id, patientData);
    }

    static async deletePatient(id) {
        return await PatientDataAccess.deletePatient(id);
    }
    static async deleteNotesByPatientId(patientId) {
    return await PatientDataAccess.deleteNotesByPatientId(patientId);
  }

    static async saveSpeedMeasurement(patientId, speedKmh, source, footLiftCount) {
    return await PatientDataAccess.saveSpeedMeasurement(patientId, speedKmh, source, footLiftCount);
}

static async getSpeedHistory(patientId) {
    return await PatientDataAccess.getSpeedHistory(patientId);
}

}

module.exports = PatientService;
