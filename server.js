//server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectDB } = require('./config/db');
const patientController = require('./controllers/patientController');
const therapistController = require('./controllers/therapistController');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// connect to the database
connectDB().then(() => {
    // Routes
    app.use('/api/patients', patientController);
    app.use('/api/therapists', therapistController);

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Server failed to start due to DB error:", err);
});
