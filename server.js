//server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectDB } = require('./config/db');
const patientController = require('./controllers/patientController');
const therapistController = require('./controllers/therapistController');
const deviceController = require('./controllers/deviceController');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/api/patients', patientController);
app.use('/api/therapists', therapistController);
app.use('/api/device', deviceController);

// connect to the database
if (require.main === module) 
{
    connectDB().then(() => {
    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Server failed to start due to DB error:", err);
});
}


module.exports = app;