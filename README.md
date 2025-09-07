# 🏥 Mobile Walking Lab - Backend Server

A comprehensive Node.js/Express backend system for the Mobile Walking Lab, a physiotherapy assessment platform that integrates real-time gait analysis from ESP32 sensors, video recording, and AI-powered treatment recommendations.

## 📋 Table of Contents
- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Pagination & Filtering](#-pagination--filtering)
- [Debounce & Request Throttling (Frontend)](#-debounce--request-throttling-frontend)
- [XIAO ESP32S3 Sense Integration](#-xiao-esp32s3-sense-integration)
- [ESP32 Integration](#-esp32-integration)
- [AI Treatment Recommendations](#-ai-treatment-recommendations)
- [Video Management](#-video-management)
- [Database Schema](#-database-schema)
- [Azure Deployment](#-azure-deployment)
- [Setup & Installation](#-setup--installation)
- [Testing](#-testing)
- [Environment Variables](#-environment-variables)
- [Key Implementation Details](#-key-implementation-details)
- [Client Integration](#-client-integration)
- [Contributing](#-contributing)
- [Developer](#-developer)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

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
┌─────────────────┐      ┌─────────────────┐
│   Web Client    │ ───▶ │  Node.js Server │
│   (React App)   │      │    (Express)    │
└─────────────────┘      └────────┬────────┘
                                  │
                     ┌────────────┼──────────────┐
                     │            │              │
             ┌───────▼──────┐  ┌──▼───┐   ┌─────▼─────┐
             │ Azure SQL DB │  │OpenAI│   │ Azure Blob│
             │   (MSSQL)    │  │ API  │   │  Storage  │
             └──────────────┘  └──────┘   └───────────┘
                 ▲    ▲
                 │    │
      ┌──────────┘    └───────────┐
      │                           │
┌─────┴───────────┐        ┌──────┴──────────────┐
│ ESP32-S3 Device │        │ ESP32-CAM (XIAO      │
│ (Sensors)       │        │ ESP32S3 Sense)       │
│ Speed/Distance, │        │ Video of gait,       │
│ Hand Pressure,  │        │ polls same command,  │
│ Foot Lifts      │        │ uploads to Blob      │
└─────────────────┘        └──────────────────────┘
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
- The system records **walking videos** using the **XIAO ESP32S3 Sense** camera.
- The camera uses the **same polling command** as the ESP32 sensor device (`start/stop/idle`).
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

### Device (ESP32-S3) Endpoints

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

```http
POST /api/video/:id/upload-video                  # camera uploads here
GET  /api/video/by-measurement/:measurementId     # retrieve by measurement
GET  /api/video/:id/videos                        # list patient videos
GET  /api/video/stream/by-measurement/:id.mp4     # browser-friendly stream
GET  /api/video/stream/by-time.mp4?patientId=..   # nearest-by-time stream
```

## 🔄 Pagination & Filtering

Both the **patients list** and **patient notes** endpoints support optional, cursor-free pagination. If you **omit** `page` and `pageSize`, the server returns the **full** (non-paginated) result. If you **include** either `page` or `pageSize`, the server returns a **paginated** payload and sets RFC-5988 **Link** headers for easy next/prev navigation.

### Patients – `GET /api/patients`
**Query parameters**

| Param     | Type   | Default | Notes |
|-----------|--------|---------|------|
| `page`    | int    | `0`     | Zero-based page index. If omitted (and `pageSize` omitted) ⇒ non-paginated mode. |
| `pageSize`| int    | `20`    | Max `100`. If omitted (and `page` omitted) ⇒ non-paginated mode. |
| `sortBy`  | string | `id`    | Sort column (whitelisted server-side; unsupported values fall back to safe default). |
| `sortDir` | enum   | `ASC`   | `ASC` \| `DESC`. |
| `qName`   | string | —       | Optional filter. `LIKE %qName%` on `first_name`, `last_name`, and `"first last"`. |
| `qId`     | string | —       | Optional filter. `LIKE %qId%` on `patient_id`. |

**Paginated response shape**
```json
{
  "data": [ /* rows */ ],
  "page": 0,
  "pageSize": 20,
  "total": 137,
  "totalPages": 7,
  "hasNext": true,
  "hasPrev": false,
  "sortBy": "id",
  "sortDir": "ASC"
}
```

**Link header (when applicable)**
```
Link: </api/patients?page=1&pageSize=20&sortBy=id&sortDir=ASC>; rel="next",
      </api/patients?page=0&pageSize=20&sortBy=id&sortDir=ASC>; rel="prev"
```

**Examples**
```http
# Full (non-paginated)
GET /api/patients

# Paginated + sorted
GET /api/patients?page=0&pageSize=20&sortBy=last_name&sortDir=ASC

# Search by name or ID with pagination
GET /api/patients?page=0&pageSize=20&qName=levi
GET /api/patients?page=0&pageSize=20&qId=1234
```

### Patient Notes – `GET /api/patients/:id/notes`
**Query parameters**

| Param     | Type | Default    | Notes |
|-----------|------|------------|------|
| `page`    | int  | `0`        | Zero-based page index. |
| `pageSize`| int  | `20`       | Max `100`. |
| `sortBy`  | string | `created_at` | Whitelisted; fallback applied if unsupported. |
| `sortDir` | enum | `DESC`     | `ASC` \| `DESC`. Default `DESC` (newest first). |

**Behavior**
- **Without** `page`/`pageSize`: returns **full notes** array (or `404` if patient not found).
- **With** pagination params: returns the **paginated envelope** (see schema above) and **Link** headers.

**Example**
```http
GET /api/patients/42/notes?page=1&pageSize=10&sortBy=created_at&sortDir=DESC
```

**Implementation Notes**
- Sorting is **whitelisted server-side** (`safeSort(...)`). Unknown columns automatically **fall back** (`patients: id`, `notes: created_at`).
- `page` is **zero-based**. `pageSize` is clamped to a **max of 100**.
- Pagination envelope includes `hasNext`/`hasPrev` to aid UI state (disable buttons, etc.).

## ⏳ Debounce & Request Throttling (Frontend)

To keep the server happy and the UI snappy, **debounce** search inputs (`qName`, `qId`) and **cancel in-flight requests** when the user types quickly or changes pages.

**Recommended**
- Debounce **300–500 ms** for text filters.
- **Reset page to 0** when filters change.
- Use `AbortController` to **cancel** the previous fetch.
- Keep `page`, `pageSize`, `sortBy`, `sortDir`, `qName`, `qId` in React state and reflect them in the query string.

**Example (React)**
```jsx
import { useEffect, useRef, useState } from "react";

function usePatients() {
  const [qName, setQName] = useState("");
  const [qId, setQId] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState("ASC");
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Reset pagination when filters change
  useEffect(() => { setPage(0); }, [qName, qId]);

  useEffect(() => {
    // Debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Cancel previous request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir
      });
      if (qName.trim()) params.set("qName", qName.trim());
      if (qId.trim())   params.set("qId", qId.trim());

      setLoading(true);
      fetch(`/api/patients?${params.toString()}`, { signal: abortRef.current.signal })
        .then(async (r) => {
          const json = await r.json();
          setResult(json);
        })
        .catch((e) => {
          if (e.name !== "AbortError") console.error(e);
        })
        .finally(() => setLoading(false));
    }, 400); // 400ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [qName, qId, page, pageSize, sortBy, sortDir]);

  return {
    qName, setQName,
    qId, setQId,
    page, setPage,
    pageSize, setPageSize,
    sortBy, setSortBy,
    sortDir, setSortDir,
    result, loading
  };
}
```

**Why this matters**
- Prevents **request storms** while typing.
- Keeps UI responsive; users see results that match their **final** intent.
- Plays nicely with the server’s **Link** headers and the pagination envelope (`hasNext`, `hasPrev`).


## 📷 XIAO ESP32S3 Sense Integration

### Camera Polling & Recording Flow
1. **Poll command**: `GET /api/device/command` every ~3s  
2. **On start**: Begin recording, upload via `POST /api/video/:patientId/upload-video`  
3. **On stop**: Finalize and ensure upload  
4. **Storage & Metadata**: Files in Azure Blob, metadata in SQL with optional `device_measurement_id`  
5. **Retrieval**: By measurement or timestamp, with SAS-secured streaming endpoints

### Frontend Behavior
- Clicking a speed bar in the chart queries `GET /api/video/by-measurement/:measurementId`
- If not found, fallback to `GET /api/video/by-time?...`
- Opens a popup with video playback


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
