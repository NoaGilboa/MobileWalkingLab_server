// services/patientService.js

const PatientDataAccess = require('../dataAccess/patientDataAccess');

class PatientService {
    static async getAllPatients() {
        return await PatientDataAccess.getAllPatients();
    }

    static async addPatient(patientData) {
        return await PatientDataAccess.addPatient(patientData);
    }

    static async getPatientById(userId) {
        return await PatientDataAccess.getPatientById(userId);
    }

    static async getNotesByPatientId(userId) {
        return await PatientDataAccess.getNotesByPatientId(userId);
    }

    static async addNoteToPatient(userId, note) {
        return await PatientDataAccess.addNoteToPatient(userId, note);
    }
}

module.exports = PatientService;


// const PatientDataAccess = require('../dataAccess/patientDataAccess');
// const Patient = require('../models/patient');

// class PatientService {
//   static getAllPatients() {
//     return PatientDataAccess.getAllPatients();
//   }

//   static addPatient(id, name, age, condition) {
//     const newPatient = new Patient(id, name, age, condition);
//     return PatientDataAccess.addPatient(newPatient);
//   }

//   static getPatientById(id) {
//     return PatientDataAccess.getPatientById(id);
//   }

//   static getNotesByPatientId(id) {
//     return PatientDataAccess.getNotesByPatientId(id);
//   }

//   static addNoteToPatient(id, note) {
//     return PatientDataAccess.addNoteToPatient(id, note);
//   }
// }

// module.exports = PatientService;
