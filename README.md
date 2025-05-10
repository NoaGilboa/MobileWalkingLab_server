
# Mobile Walking Lab Backend

This is the backend server for the **Mobile Walking Lab** application, developed using **Node.js**, **Express.js**, and **MongoDB** with **Mongoose**. It provides RESTful API endpoints for managing patients and therapists within the application.

## Table of Contents
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Technologies Used](#technologies-used)
- [API Documentation](#api-documentation)
  - [Patient Endpoints](#patient-endpoints)
  - [Therapist Endpoints](#therapist-endpoints)
- [Project Structure](#project-structure)

## Installation

To set up and run this project locally, follow these steps:

1. **Clone the repository**:

    ```sh
    git clone https://github.com/NoaGilboa/Mobile-Walking-Lab.git
    cd mobile-walking-lab-backend
    ```

2. **Install dependencies**:

    ```sh
    npm install
    ```

3. **Start MongoDB**:
   Ensure MongoDB is running on your system. The application expects it to run locally on port `27017`.

4. **Run the server**:

    ```sh
    npm start
    ```

    The server will start at `http://localhost:5001`.

## Getting Started

This backend provides RESTful APIs for managing therapists and patients in the **Mobile Walking Lab** application.

### Middleware

- **CORS**: Cross-Origin Resource Sharing is enabled to allow requests from the frontend (defaulting to `http://localhost:3000`).
- **Body Parser**: Parses incoming request bodies in a middleware before your handlers, available under `req.body`.

## Technologies Used

- **Node.js**: JavaScript runtime for server-side programming.
- **Express.js**: Web framework for creating the API.
- **MongoDB & Mongoose**: MongoDB for the database, with Mongoose as the Object Data Modeling (ODM) library.
- **body-parser**: Middleware for parsing request bodies.
- **CORS**: Allows cross-origin requests from the frontend.

Dependencies are listed in `package.json`:

```json
{
  "dependencies": {
    "body-parser": "^1.20.3",
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "mongoose": "^8.8.3"
  }
}
```

## API Documentation

### Patient Endpoints

- **`GET /api/patients`** - Retrieves all patients.
- **`POST /api/patients`** - Adds a new patient.
  - Request body:
    ```json
    {
      "userId": "string",
      "name": "string",
      "age": "number",
      "condition": "string"
    }
    ```
- **`GET /api/patients/:userId`** - Retrieves details of a specific patient by `userId`.
- **`GET /api/patients/:userId/notes`** - Retrieves all notes for a specific patient.
- **`POST /api/patients/:userId/notes`** - Adds a note to a specific patient.
  - Request body:
    ```json
    {
      "note": "string"
    }
    ```

### Therapist Endpoints

- **`POST /api/therapists/register`** - Registers a new therapist.
  - Request body:
    ```json
    {
      "email": "string",
      "password": "string",
      "name": "string"
    }
    ```
- **`POST /api/therapists/login`** - Logs in a therapist.
  - Request body:
    ```json
    {
      "email": "string",
      "password": "string"
    }
    ```

## Project Structure

```
mobileWalkingLab_server/
├── config/
│   └── db.js                   # Database connection setup
├── controllers/
│   ├── patientController.js    # Handles patient-related API routes
│   └── therapistController.js  # Handles therapist-related API routes
├── dataAccess/
│   ├── patientDataAccess.js    # Data access layer for patients
│   └── therapistDataAccess.js  # Data access layer for therapists
├── models/
│   ├── patient.js              # Patient schema for MongoDB
│   └── therapist.js            # Therapist schema for MongoDB
├── services/
│   ├── patientService.js       # Business logic layer for patients
│   └── therapistService.js     # Business logic layer for therapists
├── package.json                # Project dependencies
├── server.js                   # Entry point to start the server
└── README.md                   # Project documentation (you're here!)
```

### Connecting to MongoDB

The server connects to a MongoDB instance using the configuration from `config/db.js`. Make sure MongoDB is running locally on port `27017`:

```js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/mobile_walking_lab', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected...');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

## Usage

1. **Start the Backend**:
   ```sh
   npm start
   ```
   The backend will start on `http://localhost:5001`.

2. **API Usage**:
   Use a tool like **Postman** or **cURL** to interact with the endpoints listed above.

3. **Connecting to the Frontend**:
   Make sure the frontend is running on `http://localhost:3000` to interact with this backend server.


