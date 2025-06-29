// services/deviceService.js

const DeviceDataAccess = require('../dataAccess/deviceDataAccess');

class DeviceService {

    static async getFieldHistory(patientId,fieldNames ) {
        return await DeviceDataAccess.getSpeedHistory(patientId, fieldNames);
    }
    static async saveDeviceMeasurements(patientId, measurements) {
        return await DeviceDataAccess.saveDeviceMeasurements(patientId, measurements);
    }


}

module.exports = DeviceService;
