// models/therapist.js
const mongoose = require('mongoose');

const TherapistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Therapist', TherapistSchema);
