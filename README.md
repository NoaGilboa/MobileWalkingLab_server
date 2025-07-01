
# 🧠 Mobile Walking Lab – Server

This is the **Node.js + Express** backend server for the Mobile Walking Lab system. It acts as a central API for managing patients, receiving ESP32 device data, providing GPT-based treatment recommendations, and storing structured data in an Azure SQL database.

---

## 🚀 Features

* ✅ **Therapist authentication** (registration + login)
* 👩‍⚕️ **Manage patient data** – add/update/delete/view
* 📝 **Add and view therapist notes**
* 📊 **Save walking speed measurements** (manual or from ESP32)
* 🤖 **Generate GPT-based treatment recommendations** via OpenAI API
* 📡 **ESP32 polling interface** (commands + upload measurements - speed, distance, foot lifts, and hand pressure)
* 🧠 **Treatment insights** based on medical data + walking history

---

## 📁 Project Structure

```
server/
├── config/
│   └── db.js                   # Azure SQL DB config + schema initialization
│
├── controllers/
│   ├── deviceController.js     # ESP32 polling, data uploads
│   ├── patientController.js    # Patient APIs (CRUD, notes, speed)
│   └── therapistController.js  # Therapist login/register
│
├── dataAccess/
│   ├── deviceDataAccess.js     # SQL access for ESP32 measurements
│   ├── patientDataAccess.js    # SQL access for patients + notes
│   └── therapistDataAccess.js  # SQL access for therapists
│
├── services/
│   ├── deviceService.js        # Logic for device measurements
│   ├── patientService.js       # Business logic for patient module
│   └── openAIService.js        # GPT-3.5 logic for treatment recommendation
│
├── .env                        # API keys, DB credentials (ignored in Git)
├── server.js                   # Main entrypoint – sets up Express, routes, DB
└── package.json
```
---
---

## 📡 ESP32 Communication

### 🔁 Polling for Commands

The ESP32 microcontroller polls the server every 3 seconds to get its current command:

```
GET /api/device/command
```

Returns:

```json
{ "command": "start" | "stop" | "idle", "patientId": number }
```

The command is set when a therapist presses "Start Measurement" or "Stop Measurement" on the client UI:

```
POST /api/device/command
```

Payload:

```json
{ "command": "start", "patientId": 5 }
```

### 📤 Uploading ESP32 Measurements

Once the ESP32 finishes recording, it sends all its buffered data:

```
POST /api/device/:id/data
```

Payload:

```json
[
  {
    "speed": 1.2,
    "distance": 5.3,
    "handPressureL": 7.8,
    "handPressureR": 6.5,
    "footLiftL": 2,
    "footLiftR": 3
  }
]
```

These entries are inserted into the `device_measurements` table and linked to the patient.

### 📥 Get All Device Measurements

```
GET /api/device/:id/measurements
```

Returns grouped data by field:

```json
{
  "speed": [ { "value": 1.2, "measured_at": "..." }, ... ],
  "distance": [...],
  "handPressureL": [...],
  "handPressureR": [...],
  "footLiftL": [...],
  "footLiftR": [...]
}
```

Stored in `device_measurements` table.

---
## 📌 Sample API Routes

| Method | Route                                        | Description                      |
| ------ | -------------------------------------------- | -------------------------------- |
| POST   | `/api/therapists/login`                      | Login therapist                  |
| POST   | `/api/therapists/register`                   | Register therapist               |
| GET    | `/api/patients`                              | Get all patients                 |
| POST   | `/api/patients`                              | Add new patient                  |
| GET    | `/api/patients/:id`                          | Get patient details              |
| PUT    | `/api/patients/:id`                          | Update patient                   |
| DELETE | `/api/patients/:id`                          | Delete patient                   |
| GET    | `/api/patients/:id/notes`                    | Get patient notes                |
| POST   | `/api/patients/:id/notes`                    | Add note                         |
| DELETE | `/api/patients/:id/notes`                    | Delete all patient notes         |
| GET    | `/api/patients/:id/speed-history`            | Get speed history                |
| POST   | `/api/patients/:id/speed`                    | Save manual speed measurement    |
| POST   | `/api/patients/:id/treatment-recommendation` | Get GPT treatment recommendation |
| GET    | `/api/device/command`                        | ESP32 fetches command            |
| POST   | `/api/device/command`                        | Set command from frontend        |
| POST   | `/api/device/:id/data`                       | ESP32 uploads measurement batch  |
| GET    | `/api/device/:id/measurements`               | Fetch all ESP32 measurements     |

---

## 🧠 GPT Integration

* Implemented using [OpenAI Node SDK](https://www.npmjs.com/package/openai)
* API key stored in `.env` via `OPENAI_API_KEY`
* Builds dynamic prompts based on:

  * Age (calculated)
  * Gender, height, weight, medical condition, mobility status
  * Therapist notes
* Manual speed history
* **ESP32 sensor data**, including:

  * speed
  * distance
  * hand pressure (left & right)
  * number of foot lifts (left & right)

These values are dynamically injected into a Hebrew prompt and submitted to GPT-3.5 to generate a physiotherapy recommendation.


Example logic (see `openAIService.js`):

```js
const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "אתה פיזיותרפיסט מומחה..." },
    { role: "user", content: prompt },
  ]
});
```

---

## 🧱 Database

* Uses **Azure SQL Database**

* All tables are initialized in `config/db.js` if they don’t exist:

  * `therapists`
  * `patients`
  * `patient_notes`
  * `patient_speed_measurements`
  * `device_measurements`

* Relationships:

  * `patient_notes`, `patient_speed_measurements` and `device_measurements` reference `patients`
  * `patient_notes` also reference `therapists`

---

## ☁️ Azure Deployment

To deploy:

1. Push your code to a GitHub repo
2. Go to [Azure Portal](https://portal.azure.com)
3. Create a Web App (Node.js runtime)
4. Link deployment source to GitHub
5. Configure environment variables (`OPENAI_API_KEY`, DB creds)
6. Enable continuous deployment

> You can also deploy manually using FTP or Azure CLI.

---

## 🔧 Setup Locally

### 1. Clone the repo

```bash
git clone https://github.com/NoaGilboa/Mobile-Walking-Lab.git
cd Mobile-Walking-Lab/server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `.env`

```bash
DB_USER=your_user
DB_PASS=your_password
DB_SERVER=your_server.database.windows.net
DB_NAME=your_database
OPENAI_API_KEY=your_openai_key
```

### 4. Run the server

```bash
node server.js
```

---

## ✅ Sample `.env`

```
DB_USER=noa123456
DB_PASS=123456Noa
DB_SERVER=your-server-name.database.windows.net
DB_NAME=walkinglabdb
OPENAI_API_KEY=sk-...
```
---

## 👩‍💻 Developed By

**Noa Gilboa**
[GitHub Profile](https://github.com/NoaGilboa)


