# Smart Attendance Marker - Prototype Server

This minimal Express server stores enrolled students and attendance records in a local SQLite database (`sam.db`). It's a prototype to support the frontend prototype.

Requirements
- Node.js (v14+ recommended)

Install & run

```powershell
cd server
npm install
npm start
```

API endpoints
- POST /api/enroll
  - { fullname, roll, username, photo (dataURL) }
- POST /api/attendance
  - { username, role, date, subject, status, ts, snapshot (dataURL) }
- GET /api/students
- GET /api/attendance

Face service (optional, for server-side face recognition)
- A separate Python service is provided at `server/face_service.py` which computes face encodings and matches faces. When available, the Node server will call this service automatically on enroll and on attendance (if a snapshot is provided).

Python face service install notes (Windows PowerShell)

1. Install Python 3.8+ and ensure `pip` is available.
2. Install build tools required by `dlib` (on Windows install "Build Tools for Visual Studio").
3. From the `server` folder install dependencies and run the face service:

```powershell
cd server
python -m pip install --upgrade pip
pip install flask pillow numpy face_recognition
python face_service.py
```

If the face service starts successfully it will listen on port 5000. The Node server (port 3001) will attempt to call the face service for enroll/match operations.

Run Node server (PowerShell)

```powershell
cd server
npm install
npm start
```

Open the front-end pages in your browser (files are static HTML in the project root):
- `teacher_enroll.html` — enroll students (will POST to `/api/enroll` if server running)
- `token_admin.html` — add timetable entries (POST to `/api/timetable` or save locally)
- `token_simulator.html` — view active token for a classroom
- `student_mark.html` — student marks attendance (will POST to `/api/attendance` with snapshot when server is running)


Notes
- This server stores photos/snapshots as blobs (base64 decoded) in SQLite for prototyping only. For production, store images in object storage (S3) and store descriptors separately.
- Face recognition is not implemented server-side here; this scaffolding lets you post images and records for later processing.
