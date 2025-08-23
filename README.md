# 🏥 Mobile Walking Lab - Backend Server

A comprehensive Node.js/Express backend system for the Mobile Walking Lab, a physiotherapy assessment platform that integrates real-time gait analysis from ESP32 sensors, video recording, and AI-powered treatment recommendations.

## 📋 Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [ESP32 Integration](#esp32-integration)
- [AI Treatment Recommendations](#ai-treatment-recommendations)
- [Video Management](#video-management)
- [Database Schema](#database-schema)
- [Azure Deployment](#azure-deployment)
- [Setup & Installation](#setup--installation)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

## 🔍 Overview

The Mobile Walking Lab server acts as the central hub for a comprehensive gait analysis and physiotherapy system. It manages patient data, collects real-time measurements from ESP32 devices mounted on treadmills, stores video recordings of sessions, and provides AI-powered treatment recommendations based on collected data.

### Core Responsibilities:
- **Patient Management**: Complete CRUD operations for patient records
- **Real-time Data Collection**: Receives and processes sensor data from ESP32 devices
- **Video Storage**: Manages video recordings in Azure Blob Storage
- **AI Analysis**: Generates treatment recommendations using OpenAI GPT-3.5
- **Therapist Portal**: Authentication and session management for therapists

## 🏗️ System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│  Node.js Server │◀────│   ESP32 Device  │
│   (React App)   │     │    (Express)    │     │  (Treadmill)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
            │ Azure SQL DB │ │OpenAI│ │Azure Blob   │
            │              │ │ API  │ │Storage      │
            └──────────────┘ └──────┘ └─────────────┘
```

## ✨ Key Features

### 1. **Therapist Management**
- Secure registration and authentication
- Profile management with name updates
- Session tracking

### 2. **Patient Management**
- Comprehensive patient profiles (demographics, medical conditions, mobility status)
- Therapist notes with timestamps
- Speed measurement history
- Device measurement tracking

### 3. **ESP32 Device Integration**
- Real-time command polling (start/stop/idle)
- Batch data upload for measurements
- Multiple sensor data collection:
  - Walking speed
  - Distance traveled
  - Hand pressure (left/right)
  - Foot lift counts (left/right)

### 4. **AI-Powered Treatment Recommendations**
- Integration with OpenAI GPT-3.5
- Analysis based on:
  - Patient demographics and medical history
  - Historical speed measurements
  - ESP32 sensor data
  - Therapist notes
- Hebrew language support for recommendations

### 5. **Video Management**
- Upload patient session videos to Azure Blob Storage
- Associate videos with device measurements
- Secure access with SAS token generation
- Retrieval by measurement ID

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1.0
- **Database**: Azure SQL Database (MSSQL)
- **Cloud Storage**: Azure Blob Storage
- **AI**: OpenAI API (GPT-3.5-turbo)
- **Authentication**: Custom implementation
- **Testing**: Jest + Supertest
- **File Upload**: Multer
- **CORS**: Enabled for cross-origin requests

## 📁 Project Structure

```
server/
├── config/
│   └── db.js                   # Azure SQL connection & schema initialization
├── controllers/
│   ├── deviceController.js     # ESP32 command/data endpoints
│   ├── patientController.js    # Patient CRUD & notes management
│   ├── therapistController.js  # Authentication & therapist management
│   └── videoController.js      # Video upload/retrieval endpoints
├── dataAccess/
│   ├── deviceDataAccess.js     # SQL queries for device data
│   ├── patientDataAccess.js    # SQL queries for patient data
│   └── therapistDataAccess.js  # SQL queries for therapist data
├── services/
│   ├── deviceService.js        # Device data business logic
│   ├── patientService.js       # Patient management logic
│   ├── openAIService.js        # GPT integration for recommendations
│   ├── therapistService.js     # Therapist authentication logic
│   └── videoService.js         # Azure Blob Storage operations
├── tests/
│   ├── deviceController.test.js
│   ├── patientController.test.js
│   └── therapistController.test.js
├── .env                        # Environment variables
├── server.js                   # Express app entry point
└── package.json
```

## 📡 API Documentation

### Therapist Endpoints

```javascript
// Register new therapist
POST /api/therapists/register
Body: {
  therapist_id: string,
  name: string,
  email: string,
  password: string
}

// Login
POST /api/therapists/login
Body: {
  email: string,
  password: string
}

// Update therapist name
PUT /api/therapists/:id/name
Body: { name: string }
```

### Patient Endpoints

```javascript
// Get all patients
GET /api/patients

// Get specific patient
GET /api/patients/:id

// Add new patient
POST /api/patients
Body: {
  patient_id: string,
  first_name: string,
  last_name: string,
  birth_date: date,
  gender: string,
  weight: number,
  height: number,
  phone: string,
  email: string,
  medical_condition: string,
  mobility_status: string
}

// Update patient
PUT /api/patients/:id

// Delete patient
DELETE /api/patients/:id

// Patient notes
GET /api/patients/:id/notes
POST /api/patients/:id/notes
Body: { therapistId: number, note: string }
DELETE /api/patients/:id/notes

// Speed measurements
POST /api/patients/:id/speed
Body: {
  speed_kmh: number,
  source: string,
  foot_lift_count: number
}
GET /api/patients/:id/speed-history

// AI treatment recommendation
POST /api/patients/:id/treatment-recommendation
```

### Device (ESP32) Endpoints

```javascript
// Get current command (polled by ESP32)
GET /api/device/command
Response: {
  command: "start" | "stop" | "idle",
  patientId: number
}

// Set command from frontend
POST /api/device/command
Body: {
  command: "start" | "stop" | "idle",
  patientId: number
}

// Upload measurement batch from ESP32
POST /api/device/:id/data
Body: [{
  speed: number,
  distance: number,
  handPressureL: number,
  handPressureR: number,
  footLiftL: number,
  footLiftR: number
}]

// Retrieve all measurements
GET /api/device/:id/measurements
Response: {
  speed: [{value, measured_at}],
  distance: [{value, measured_at}],
  handPressureL: [{value, measured_at}],
  handPressureR: [{value, measured_at}],
  footLiftL: [{value, measured_at}],
  footLiftR: [{value, measured_at}]
}
```

### Video Endpoints

```javascript
// Upload video
POST /api/video/:id/upload-video
Body: FormData with video file
Optional: device_measurement_id

// Get video by measurement ID
GET /api/video/by-measurement/:measurementId

// Get all videos for patient
GET /api/video/:id/videos
```

## 🔌 ESP32 Integration

### Communication Protocol

The ESP32 device continuously polls the server for commands and uploads collected data:

#### 1. **Command Polling (Every 3 seconds)**
```javascript
// deviceController.js - Command management
let currentCommand = {
  command: 'idle',
  patientId: null
};

router.get('/command', (req, res) => {
  res.json({ command: currentCommand });
});
```

#### 2. **Data Upload Flow**
```javascript
// deviceController.js - Receiving ESP32 measurements
router.post('/:id/data', async (req, res) => {
  const patientId = parseInt(req.params.id);
  const measurements = req.body; // Array of measurement objects
  
  await DeviceService.saveDeviceMeasurements(patientId, measurements);
  res.json({ message: 'Measurements received', count: measurements.length });
});
```

### Sensor Data Structure
- **Speed**: Walking speed in m/s
- **Distance**: Total distance covered in meters
- **Hand Pressure L/R**: Pressure applied on treadmill handles (0-10 scale)
- **Foot Lift L/R**: Number of times each foot lifted from surface

## 🤖 AI Treatment Recommendations

### OpenAI Integration

The system uses GPT-3.5-turbo to generate personalized treatment recommendations:

```javascript
// openAIService.js - Core recommendation logic
async function getTreatmentRecommendation(patientData) {
  const prompt = `
    מטופל במעבדת הליכה ניידת:
    - גיל: ${age}
    - מין: ${gender}
    - משקל: ${weight} ק״ג
    - גובה: ${height} ס״מ
    - מצב רפואי: ${medical_condition}
    - מצב ניידות: ${mobility_status}
    - הערות קודמות: ${notesText}
    - היסטוריית מהירויות הליכה: ${speedText}
    - מדדים מהבקר: ${espText}
    
    בהתבסס על הנתונים הללו, תן המלצה טיפולית כללית לשיפור ההליכה...
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "אתה פיזיותרפיסט מומחה..." },
      { role: "user", content: prompt }
    ],
    max_tokens: 1500,
    temperature: 0.7
  });

  return response.choices[0].message.content.trim();
}
```

### Data Processing
- Aggregates patient medical history
- Processes ESP32 sensor readings
- Formats therapist notes chronologically
- Calculates age from birth date
- Generates Hebrew-language recommendations

## 📹 Video Management

### Azure Blob Storage Integration

```javascript
// videoController.js - Video upload process
router.post('/:id/upload-video', upload.single('video'), async (req, res) => {
  const fileName = `${patientId}_${Date.now()}_${file.originalname}`;
  
  // Upload to Azure Blob Storage
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(file.buffer);
  
  // Store metadata in SQL
  await pool.request()
    .input('patient_id', sql.Int, patientId)
    .input('file_name', sql.NVarChar, fileName)
    .input('blob_url', sql.NVarChar, blockBlobClient.url)
    .input('device_measurement_id', sql.Int, device_measurement_id)
    .query(`INSERT INTO patient_videos...`);
});
```

### SAS Token Generation
Secure access to videos using time-limited SAS tokens:

```javascript
const sasToken = generateBlobSASQueryParameters({
  containerName,
  blobName: video.file_name,
  permissions: BlobSASPermissions.parse('r'),
  protocol: SASProtocol.Https,
  startsOn: new Date(Date.now() - 5 * 60 * 1000),
  expiresOn: new Date('2030-12-31T23:59:59Z')
}, sharedKeyCredential).toString();
```

## 🗄️ Database Schema

### Tables Structure

```sql
-- Therapists table
CREATE TABLE therapists (
  id INT IDENTITY(1,1) PRIMARY KEY,
  therapist_id NVARCHAR(255) NOT NULL UNIQUE,
  name NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password NVARCHAR(255) NOT NULL
);

-- Patients table
CREATE TABLE patients (
  id INT IDENTITY(1,1) PRIMARY KEY,
  patient_id NVARCHAR(255) NOT NULL UNIQUE,
  first_name NVARCHAR(255) NOT NULL,
  last_name NVARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  age AS DATEDIFF(YEAR, birth_date, GETDATE()),
  gender NVARCHAR(50),
  weight FLOAT,
  height FLOAT,
  phone NVARCHAR(20),
  email NVARCHAR(255),
  medical_condition NVARCHAR(MAX),
  mobility_status NVARCHAR(100),
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME
);

-- Patient notes
CREATE TABLE patient_notes (
  id INT IDENTITY(1,1) PRIMARY KEY,
  patient_id INT NOT NULL,
  therapist_id INT NOT NULL,
  created_by_name NVARCHAR(255) NOT NULL,
  note NVARCHAR(MAX),
  created_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE
);

-- Speed measurements
CREATE TABLE patient_speed_measurements (
  id INT IDENTITY(1,1) PRIMARY KEY,
  patient_id INT NOT NULL,
  speed_kmh FLOAT NOT NULL,
  measured_at DATETIME DEFAULT GETDATE(),
  source NVARCHAR(50) DEFAULT 'manual',
  foot_lift_count INT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Device measurements from ESP32
CREATE TABLE device_measurements (
  id INT IDENTITY(1,1) PRIMARY KEY,
  patient_id INT NOT NULL,
  measured_at DATETIME DEFAULT GETDATE(),
  speed FLOAT NOT NULL,
  distance FLOAT NOT NULL,
  handPressureL FLOAT NOT NULL,
  handPressureR FLOAT NOT NULL,
  footLiftL INT NULL,
  footLiftR INT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Video storage metadata
CREATE TABLE patient_videos (
  id INT IDENTITY PRIMARY KEY,
  patient_id INT NOT NULL,
  device_measurement_id INT NULL,
  file_name NVARCHAR(255) NOT NULL,
  blob_url NVARCHAR(MAX) NOT NULL,
  uploaded_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (device_measurement_id) REFERENCES device_measurements(id) ON DELETE SET NULL
);
```

## ☁️ Azure Deployment

### Deployment via GitHub Actions

The project includes a GitHub Actions workflow for automatic deployment to Azure Web Apps:

```yaml
# .github/workflows/azure-webapps-node.yml
name: Deploy Node.js app to Azure Web App

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18.x'
    - run: npm install
    - uses: azure/webapps-deploy@v2
      with:
        app-name: walkinglab
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: .
```

### Azure Resources Required
1. **Azure Web App** (Node.js 18 runtime)
2. **Azure SQL Database**
3. **Azure Blob Storage** (Container: `patient-videos`)
4. **Application Settings** (Environment variables)

### Manual Deployment Steps
1. Create Azure Web App with Node.js runtime
2. Configure deployment source (GitHub/Local Git)
3. Set environment variables in Application Settings
4. Enable CORS if needed
5. Configure startup command: `node server.js`

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+
- Azure SQL Database instance
- Azure Storage Account
- OpenAI API key

### Local Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/NoaGilboa/Mobile-Walking-Lab.git
cd Mobile-Walking-Lab/server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create `.env` file:
```env
# Database Configuration
DB_USER=your_azure_sql_user
DB_PASS=your_azure_sql_password
DB_SERVER=your-server.database.windows.net
DB_NAME=walkinglabdb

# OpenAI API
OPENAI_API_KEY=sk-your-openai-key

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
AZURE_STORAGE_ACCOUNT_KEY=your_storage_key

# Server
PORT=5001
```

4. **Initialize database**
The database tables are automatically created on first connection via `config/db.js`

5. **Run the server**
```bash
npm start
```

## 🧪 Testing

### Test Suite Overview

The project includes comprehensive integration tests using Jest and Supertest:

```bash
# Run all tests
npm test

# Test files:
# - tests/deviceController.test.js    # ESP32 integration tests
# - tests/patientController.test.js   # Patient management tests  
# - tests/therapistController.test.js # Authentication tests
```

### Test Coverage
- **Device Controller**: Command polling, validation, measurement upload
- **Patient Controller**: CRUD operations, notes, speed history, AI recommendations
- **Therapist Controller**: Registration, login, authentication flows

### Test Database Setup
Tests use the same Azure SQL instance with automatic cleanup:
```javascript
beforeAll(async () => {
  await connectDB();
  // Create test data
});

afterAll(async () => {
  // Clean up test data
  await sql.close();
});
```

## 🔐 Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DB_USER` | Azure SQL username | `admin123` |
| `DB_PASS` | Azure SQL password | `SecurePass123!` |
| `DB_SERVER` | Azure SQL server URL | `myserver.database.windows.net` |
| `DB_NAME` | Database name | `walkinglabdb` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage connection string | `DefaultEndpointsProtocol=https;...` |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account name | `walkinglab` |
| `AZURE_STORAGE_ACCOUNT_KEY` | Storage account key | `base64key==` |
| `PORT` | Server port | `5001` |

## 🔧 Key Implementation Details

### Database Connection Pool
```javascript
// config/db.js
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,  // Required for Azure
    trustServerCertificate: false
  }
};
```

### Error Handling Pattern
```javascript
// Standard error handling in controllers
try {
  const result = await Service.method(params);
  res.json(result);
} catch (error) {
  console.error("Error:", error);
  res.status(500).json({ error: error.message });
}
```

### Data Access Layer Pattern
```javascript
// Example from patientDataAccess.js
static async getPatientById(id) {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query("SELECT * FROM patients WHERE id = @id;");
    return result.recordset[0];
  } catch (error) {
    throw new Error(`Error retrieving patient: ${error.message}`);
  }
}
```

## 📱 Client Integration

The server is designed to work with:
1. **React Web Application**: Therapist dashboard for patient management
2. **ESP32 Microcontroller**: Real-time sensor data collection
3. **ESP32-CAM Module**: Video recording during sessions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👩‍💻 Developer

**Noa Gilboa**  
[GitHub Profile](https://github.com/NoaGilboa)

## 📄 License

ISC License - See LICENSE file for details

## 🙏 Acknowledgments

- Azure for cloud infrastructure
- OpenAI for GPT-3.5 API
- ESP32 community for hardware integration support

---

*This server is part of the Mobile Walking Lab system, designed to revolutionize physiotherapy assessment through technology integration.*