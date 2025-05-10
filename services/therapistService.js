// services/therapistService.js

const TherapistDataAccess = require('../dataAccess/therapistDataAccess');

class TherapistService {
    static async registerTherapist(therapistData) {
        return await TherapistDataAccess.addTherapist(therapistData);
    }

    static async loginTherapist(email, password) {
        const therapist = await TherapistDataAccess.getTherapistByEmail(email);
        if (therapist && therapist.password === password) {
            return therapist;
        }
        return null;
    }
}

module.exports = TherapistService;
