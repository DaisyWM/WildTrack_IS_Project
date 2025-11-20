🦁 WildTrack – Wildlife Intrusion Detection & Alert System

A computer-vision wildlife intrusion detection system built to help farmers near conservation areas identify dangerous animals early and receive real-time alerts.
WildTrack uses YOLOv8m, a Node.js backend, and a Progressive Web App (PWA) interface to detect species like elephants, zebras, baboons, warthogs, and lions.

Developed as a Final-Year Computer Science Project at Strathmore University.

🌍 Project Overview

WildTrack helps reduce human–wildlife conflict by:

🖼 Detecting animals in uploaded video clips

🧠 Classifying species using a trained YOLOv8m model

💾 Logging detections in a MongoDB database

🔔 Sending push notifications to farmers & KWS rangers

📱 Providing a clean PWA interface to view alerts & upload videos

Because this was a computer vision–focused project, video uploads were used for controlled testing instead of a live camera feed.

🐘 Supported Wildlife Classes

The YOLOv8m model was trained to detect:

elephant

zebra

warthog

baboon

lion

background (non-animal)

🤖 Model Summary

Model: YOLOv8m (Ultralytics)
Training Environment: Lightning AI (NVIDIA T4 GPU)
Dataset Sources: Snapshot Serengeti (LILA Wildlife) + iNaturalist
Training Epochs: 100
Performance:

mAP@0.5 ≈ 0.876

Elephant AP ≈ 0.92 (highest performing class)

Strong precision–recall separation across all species

Model Location in Repo:

model_training/models/training_v2_wildtrack.pt

⚙️ System Architecture

WildTrack includes 3 main components:

1. Model Training (Python + Ultralytics)

Runs on Lightning AI with checkpoint resuming and GPU acceleration.

2. Backend API (Node.js + Express)

Handles:

Video uploads

Running detect_animals.py

Logging detections to MongoDB

Sending push notifications (Firebase Web Push)

3. Progressive Web App (React PWA)

Includes:

Farmer Dashboard

Ranger Dashboard

Upload Screen

Alerts Screen

Mobile installable interface

🛠️ Requirements
Backend

Node.js 18+

Python 3.10+

MongoDB Atlas / Local MongoDB

Ultralytics YOLO

Firebase Cloud Messaging

Frontend

React

Service Worker

Manifest.json

Web Push API

📦 Setup Instructions
1. Clone the Repository
git clone https://github.com/DaisyWM/WildTrack_IS_Project.git
cd WildTrack_IS_Project

🐍 2. Install Python Dependencies

Create virtual environment:

python -m venv venv
venv\Scripts\activate   # Windows


Install packages:

pip install ultralytics opencv-python numpy pillow

🟩 3. Install Node.js Backend
cd backend
npm install


Create your .env file:

MONGO_URI=<your_connection_string>
WEB_PUSH_PRIVATE_KEY=...
WEB_PUSH_PUBLIC_KEY=...
FIREBASE_SERVER_KEY=...


Start backend:

node server.js

🟦 4. Start the PWA Frontend
cd ../pwa_app
npm install
npm start

🎯 Features

✔ YOLOv8m Wildlife Detection
✔ Motion Filtering (less false positives)
✔ Real-Time Push Notifications
✔ Detection Logs (MongoDB)
✔ Offline-capable Progressive Web App

📁 Project Structure
WildTrack_IS_Project/
│
├── backend/
│   ├── detect_animals.py
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── ...
│
├── pwa_app/
│   ├── public/
│   ├── src/
│   └── ...
│
└── model_training/
    └── models/training_v2_wildtrack.pt

🧪 Testing Summary

The following components were tested:

🔹 Video Upload

Uploads processed successfully using the PWA interface.

🔹 Model Inference

YOLOv8m correctly detected elephants, zebras, baboons, lions, and warthogs.

🔹 Alerts Page

Detection logs displayed correctly with timestamps & species labels.

🔹 Push Notifications

Real-time alerts delivered to browser and mobile via Firebase Cloud Messaging.

💻 Training Code Example
model = YOLO('yolov8m.pt')
model.train(
    data='yolo_dataset_v2/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    device='cuda',
    optimizer='AdamW'
)

📊 Training Results

Included:

Training loss curves

Precision–Recall curves

F1–Confidence curves

Confusion Matrix

(Place images inside: model_training/training_results/)

🚀 Deployment Options

WildTrack can be deployed to:

Railway / Render (Backend)

Firebase Hosting (PWA)

MongoDB Atlas (Cloud Database)

Lightning AI (Model Training)

📚 Acknowledgements

Datasets:

Snapshot Serengeti — LILA Wildlife Archives

iNaturalist 2023

Model Framework:

Ultralytics YOLOv8

👩‍💻 Author

Daisy W.
Bachelor of Science in Computer Science
Strathmore University