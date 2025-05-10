// models/patient.js
const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
      },
  name: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    required: true,
  },
  condition: {
    type: String,
    required: true,
  },
  notes: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model('Patient', PatientSchema);
