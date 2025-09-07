// services/patientService.js

const PatientDataAccess = require('../dataAccess/patientDataAccess');

class PatientService {
    static async getAllPatients() {
        return await PatientDataAccess.getAllPatients();
    }

    /**
     * @param {{page:number, pageSize:number, sortBy?:string, sortDir?:'ASC'|'DESC'}} opts
     * @returns {Promise<{data:any[], page:number, pageSize:number, total:number, totalPages:number, hasNext:boolean, hasPrev:boolean, sortBy:string, sortDir:'ASC'|'DESC'}>}
     */
    static async getAllPatientsPaginated(opts) {
        return await PatientDataAccess.getAllPatientsPaginated(opts);
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

    /**
     * @param {number} patientId
     * @param {{page:number, pageSize:number, sortBy?:string, sortDir?:'ASC'|'DESC'}} opts
     * @returns {Promise<{data:any[], page:number, pageSize:number, total:number, totalPages:number, hasNext:boolean, hasPrev:boolean, sortBy:string, sortDir:'ASC'|'DESC'}>}
     */
    static async getNotesByPatientIdPaginated(patientId, opts) {
        return await PatientDataAccess.getNotesByPatientIdPaginated(patientId, opts);
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
