# 🌾 CropIQ — AI-Powered Weed Detection for Farmers
### Powered by YOLOv9–YOLOv11 Hybrid Model | Groq LLM | React + Flask

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Flask](https://img.shields.io/badge/Flask-3.x-black?style=for-the-badge&logo=flask)
![YOLO Hybrid](https://img.shields.io/badge/YOLOv9--v11%20Hybrid%20Model-Detection-purple?style=for-the-badge)
![Groq](https://img.shields.io/badge/Groq-LLM-orange?style=for-the-badge)

**CropIQ** is a full-stack AI web application that helps Indian farmers detect weeds in their crop fields using a custom-trained **YOLOv9–YOLOv11 Hybrid Model** and get instant organic removal recommendations powered by the Groq LLM API.

</div>

---

## 📸 Features

- 🔍 **Upload Image Scan** — Upload a crop photo and get instant weed detection results
- 📷 **Live Camera Detection** — Real-time weed detection using your webcam (YOLO on every frame)
- 🤖 **AI Chat Assistant** — Ask any farming question to an agricultural AI (powered by Groq/Llama)
- 📜 **Scan History** — View all past scans with weed names, recommendations, and images
- 🌐 **Multi-Language Support** — Translate content using Deep Translator (Google Translate)
- 🔐 **User Authentication** — Secure JWT-based login/register with bcrypt password hashing
- 📊 **Dashboard** — Personal stats including total scans and detected weeds
- 🌱 **Tip of the Day** — Daily crop care tips fetched from the Perenual API

---

## 🖼️ Screenshots

<div align="center">

### Landing Page
![Landing Page](./screenshots/landing-page.png)

### Sign Up
![Sign Up](./screenshots/signup-page.png)

### Login
![Login](./screenshots/login-page.png)

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Upload Image for Detection
![Upload Image](./screenshots/upload-image.png)

### Weed Classification Result
![Classification Result](./screenshots/classification-result.png)

### Organic Removal Recommendations
![Recommendations](./screenshots/recommendations.png)

### Live Camera Detection
![Live Camera Scanner](./screenshots/live-camera-scanner.png)

### Multi-Language Support
![Multi-Language Support](./screenshots/multilingual-support.png)

### AI Crop Assistant Chat
![Crop Assistant](./screenshots/chat-assistant.png)

### Edit Profile
![Edit Profile](./screenshots/edit-profile.png)

### Scan History
![Scan History](./screenshots/scan-history.png)

</div>

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router v7, react-markdown, lucide-react, react-icons |
| **Backend** | Flask, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Migrate, Flask-CORS |
| **Database** | SQLite (local dev) / PostgreSQL (production) |
| **ML Model** | YOLOv9–YOLOv11 Hybrid (`best.pt`) — custom-trained weed detection model |
| **LLM** | Groq API (Llama 3.1 8B Instant) — recommendations & AI chat |
| **Translation** | Deep Translator (Google Translate backend) |
| **Auth** | JWT (24h tokens) + bcrypt password hashing |

---

## 📁 Project Structure

```
CropIQ-AI-Weed-Detection/
├── screenshots/                  # README screenshots
│   ├── landing-page.png
│   ├── signup-page.png
│   ├── login-page.png
│   ├── dashboard.png
│   ├── upload-image.png
│   ├── classification-result.png
│   ├── recommendations.png
│   ├── live-camera-scanner.png
│   ├── multilingual-support.png
│   ├── chat-assistant.png
│   ├── edit-profile.png
│   └── scan-history.png
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory, extensions, blueprints
│   │   ├── models.py            # User & ScanHistory DB models
│   │   ├── auth/                # Auth routes (register, login, profile)
│   │   ├── main/                # Core routes (scan, realtime, chat, history)
│   │   ├── crop_assistant/      # AI assistant routes
│   │   ├── tips/                # Crop tips routes
│   │   └── services/
│   │       ├── weed_detector.py      # YOLOv9-v11 Hybrid weed detection logic
│   │       ├── groq_client.py        # Groq LLM API client
│   │       ├── realtime_scanner.py   # Webcam frame processing
│   │       └── translation_service.py
│   ├── best.pt                  # YOLOv9-YOLOv11 Hybrid model weights (~83 MB)
│   ├── config.py                # Flask configuration
│   ├── run.py                   # App entry point
│   ├── .env                     # Environment variables (not committed)
│   ├── requirements.txt         # Python dependencies
│   └── migrations/              # Alembic DB migrations
└── frontend/
    ├── src/
    │   ├── App.js               # Routes definition
    │   ├── config.js             # API base URL
    │   ├── context/             # Auth context (global user state)
    │   ├── services/            # API service helpers
    │   └── user/
    │       ├── pages/           # All page components
    │       ├── components/      # Reusable components
    │       └── styles/          # Per-page CSS
    └── package.json
```

## ⚙️ Prerequisites

Make sure you have the following installed:

- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- A [Groq API Key](https://console.groq.com/) (free)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/JaspinderKaurWalia26/CropIQ-AI-Weed-Detection-Identification.git

cd CropIQ-AI-Weed-Detection-Identification
```

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
# Database (leave blank to use local SQLite automatically)
# DATABASE_URL=postgresql://user:password@host/dbname

# JWT Secret — change this to any random string
JWT_SECRET_KEY=your-very-strong-random-secret-key

# Groq LLM API
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Groq Assistant API (for crop assistant)
GROQ_ASSISTANT_API_KEY=your_groq_assistant_api_key_here

# Perenual API (for tip of the day)
PERENUAL_KEY=your_perenual_api_key_here

# YOLO Model — YOLOv9-YOLOv11 Hybrid
MODEL_PATH=best.pt

# Flask settings
FLASK_ENV=development
FLASK_DEBUG=True
```

#### Run the Backend

```bash
python run.py
```

✅ Backend running at: **http://127.0.0.1:5000**

---

### 3. Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

✅ Frontend running at: **http://localhost:3000**

---

## 👩‍💻 Author

**Jaspinder Kaur Walia**

- GitHub: [@JaspinderKaurWalia26](https://github.com/JaspinderKaurWalia26)
