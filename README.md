# 🦁 WildTrack – Wildlife Intrusion Detection & Alert System

A computer-vision wildlife intrusion detection system built to help farmers near conservation areas identify dangerous animals early and receive real-time alerts. WildTrack uses YOLOv8m, a Node.js backend, and a Progressive Web App (PWA) interface to detect species like elephants, zebras, baboons, warthogs, and lions.

Developed as a Final-Year Computer Science Project at Strathmore University.

## 🌍 Project Overview

WildTrack helps reduce human–wildlife conflict by:

- 🖼 Detecting animals in uploaded video clips
- 🧠 Classifying species using a trained YOLOv8m model
- 💾 Logging detections in a MongoDB database
- 🔔 Sending push notifications to farmers & KWS rangers
- 📱 Providing a clean PWA interface to view alerts & upload videos

Because this was a computer vision–focused project, video uploads were used for controlled testing instead of a live camera feed.

## 🐘 Supported Wildlife Classes

The YOLOv8m model was trained to detect:

- elephant  
- zebra  
- warthog  
- baboon  
- lion  
- background (non-animal)

## 🤖 Model Summary

**Model:** YOLOv8m (Ultralytics)  
**Training Environment:** Lightning AI (NVIDIA T4 GPU)  
**Dataset Sources:** Snapshot Serengeti (LILA Wildlife) + iNaturalist  
**Training Epochs:** 100  

**Performance:**
- **mAP@0.5 ≈ 0.876**
- **Elephant AP ≈ 0.92** (best performing class)
- Strong precision–recall separation across all species

**Model Location in Repo:**

```
model_training/models/training_v2_wildtrack.pt
```

## ⚙️ System Architecture

WildTrack includes 3 main components:

### 1️⃣ Model Training (Python + Ultralytics)
- Runs on Lightning AI with checkpoint resuming  
- Uses YOLOv8m for object detection

### 2️⃣ Backend API (Node.js + Express)
Handles:
- Video uploads  
- Running `detect_animals.py`  
- Logging detections to MongoDB  
- Sending push notifications (Firebase Web Push)

### 3️⃣ Progressive Web App (React PWA)
Includes:
- Farmer Dashboard  
- Ranger Dashboard  
- Upload Screen  
- Alerts Screen  
- Mobile installable interface  

## 🛠️ Requirements

### Backend
- Node.js 18+  
- Python 3.10+  
- MongoDB Atlas / Local MongoDB  
- Ultralytics YOLO  
- Firebase Cloud Messaging  

### Frontend
- React  
- Service Worker  
- Manifest.json  
- Web Push API  

## 📦 Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/DaisyWM/WildTrack_IS_Project.git
cd WildTrack_IS_Project
```

### 2️⃣ Install Python Dependencies
Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate     # Windows
```

Install essentials:
```bash
pip install ultralytics opencv-python numpy pillow
```

### 3️⃣ Install Node.js Backend
```bash
cd backend
npm install
```

Create your `.env`:
```
MONGO_URI=<your_connection_string>
WEB_PUSH_PRIVATE_KEY=...
WEB_PUSH_PUBLIC_KEY=...
FIREBASE_SERVER_KEY=...
```

Start backend:
```bash
node server.js
```

### 4️⃣ Start the PWA Frontend
```bash
cd ../pwa_app
npm install
npm start
```

## 🎯 Features

✔ YOLOv8m Wildlife Detection  
✔ Motion Filtering (reduced false positives)  
✔ Real-Time Push Notifications  
✔ Detection Logs (MongoDB)  
✔ Installable PWA (offline-capable)

## 📁 Project Structure
```
WildTrack_IS_Project/
├── backend/
│   ├── detect_animals.py
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── ...
├── pwa_app/
│   ├── public/
│   ├── src/
│   └── ...
└── model_training/
    └── models/training_v2_wildtrack.pt
```

## 🧪 Testing Summary

### 🔹 Video Upload
PWA successfully accepted MP4 files.

### 🔹 Model Inference
Detected elephants, zebras, baboons, lions, and warthogs.

### 🔹 Alerts Page
All detections saved and displayed correctly.

### 🔹 Push Notifications
Delivered via Firebase to desktop + mobile.

## 💻 Training Code Example
```python
from ultralytics import YOLO

model = YOLO('yolov8m.pt')
model.train(
    data='yolo_dataset_v2/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    device='cuda',
    optimizer='AdamW'
)
```

## 📊 Training Results

Includes:
- Training loss curves  
- Precision–Recall curves  
- F1–Confidence curves  
- Confusion Matrix  

Place images inside:
```
model_training/training_results/
```

## 🚀 Deployment Options

WildTrack can be deployed using:
- Railway / Render (Backend)
- Firebase Hosting (PWA)
- MongoDB Atlas (Database)
- Lightning AI (Training)

## 📚 Acknowledgements

**Datasets:**
- Snapshot Serengeti – LILA Wildlife Archives  
- iNaturalist 2023  

**Frameworks:**
- Ultralytics YOLOv8  

## 👩‍💻 Author

**Daisy W.**  
Bachelor of Science in Computer Science  
Strathmore University
