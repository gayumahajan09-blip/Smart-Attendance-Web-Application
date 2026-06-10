// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const DB_PATH = path.join(__dirname, 'sam.db');
const db = new Database(DB_PATH);

// Initialize tables
db.prepare(`CREATE TABLE IF NOT EXISTS students(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT,
  roll TEXT,
  username TEXT UNIQUE,
  photo BLOB,
  created INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS attendance(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  role TEXT,
  date TEXT,
  subject TEXT,
  status TEXT,
  ts INTEGER,
  snapshot BLOB
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS timetable(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classroom TEXT,
  token TEXT,
  start_ts INTEGER,
  end_ts INTEGER,
  created INTEGER
)`).run();

const app = express();
// Allow cross-origin requests and credentials so simulator on other origins can request demo-connect
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Campus network enforcement middleware ---
// Allow localhost and common private ranges by default
const DEFAULT_ALLOWED_PREFIXES = ['127.', '::1', '10.', '192.168.'];
for (let i = 16; i <= 31; i++) DEFAULT_ALLOWED_PREFIXES.push('172.' + i + '.');

// Optional override via env var: ALLOWED_IP_PREFIXES="127.,10.,192.168.,172.16.,172.17."
const ALLOWED_PREFIXES = (process.env.ALLOWED_IP_PREFIXES &&
  process.env.ALLOWED_IP_PREFIXES.split(',').map(s => s.trim()).filter(Boolean)) ||
  DEFAULT_ALLOWED_PREFIXES;

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map(p => p.trim());
    if (parts.length) return parts[0];
  }
  if (req.ip) return req.ip.replace('::ffff:', '');
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress.replace('::ffff:', '');
  }
  return null;
}

function ipIsAllowed(ip) {
  if (!ip) return false;
  for (const p of ALLOWED_PREFIXES) {
    if (ip.startsWith(p)) return true;
  }
  return false;
}

function isOnCampusCookie(req) {
  try {
    const cookieHeader = req.headers && req.headers.cookie;
    if (!cookieHeader) return false;
    return cookieHeader.split(';').map(s => s.trim()).some(s => s.startsWith('sam_oncampus=1'));
  } catch (e) { return false; }
}

function checkIfAllowed(req) {
  const ip = getClientIp(req);
  return ipIsAllowed(ip) || isOnCampusCookie(req);
}

// Student-facing pages and APIs that must be campus-only (or demo cookie)
const RESTRICTED_PATHS = [
  '/student_mark.html',
  '/student_records.html',
  '/studentdashboard.html',
  '/api/attendance',
  '/api/student-photo',
  '/api/attendance-snapshot'
];

app.use((req, res, next) => {
  try {
    const urlPath = req.path || req.url || "";
    const matches = RESTRICTED_PATHS.some(prefix => urlPath === prefix || urlPath.startsWith(prefix));
    if (matches) {
      const ip = getClientIp(req);
      if (!checkIfAllowed(req)) {
        console.log(`[ACCESS DENIED] ${urlPath} from ${ip} (allowedPrefixes=${ALLOWED_PREFIXES.join(',')})`);
        return res.status(403).json({ error: 'access_denied', message: 'This resource is only available on the campus network.' });
      }
    }
  } catch (e) { /* continue */ }
  next();
});

// Debug endpoint
app.get('/api/whoami', (req, res) => {
  const ip = getClientIp(req);
  const allowed = checkIfAllowed(req);
  res.json({ ip, allowed, allowedPrefixes: ALLOWED_PREFIXES });
});

// Demo connect endpoint: allows the WiFi simulator (any origin) to request a demo cookie be set
app.post('/api/demo-connect', (req, res) => {
  try {
    const { ssid, pwd } = req.body || {};
    const maxAgeSeconds = 7 * 24 * 60 * 60; // 7 days
    // set cookies for Node origin
    res.cookie('sam_oncampus', '1', { maxAge: maxAgeSeconds * 1000, path: '/' });
    res.cookie('sam_ssid', ssid || '', { maxAge: maxAgeSeconds * 1000, path: '/' });
    res.cookie('sam_wifi_pwd', pwd || '', { maxAge: maxAgeSeconds * 1000, path: '/' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Serve static front-end from project root
app.use(express.static(path.join(__dirname, '..')));

// Enroll endpoint
app.post('/api/enroll', (req, res) => {
  const { fullname, roll, username, photo } = req.body;
  if (!fullname || !username) return res.status(400).json({ error: 'missing fields' });
  try {
    const stmt = db.prepare('INSERT INTO students(fullname,roll,username,photo,created) VALUES(?,?,?,?,?)');
    const photoBuf = photo ? Buffer.from((photo.split(',')[1] || ""), 'base64') : null;
    stmt.run(fullname, roll, username, photoBuf, Date.now());

    (async function () {
      try {
        await fetch('http://127.0.0.1:5000/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, photo })
        });
      } catch (e) { /* ignore face service errors */ }
    })();

    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db error', details: e.message }); }
});

async function matchFace(snapshot) {
  try {
    const resp = await fetch('http://127.0.0.1:5000/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: snapshot })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (e) { return null; }
}

// Attendance endpoint with optional face verification
app.post('/api/attendance', async (req, res) => {
  const { username, role, date, subject, status, ts, snapshot } = req.body;
  if (!username || !date) return res.status(400).json({ error: 'missing fields' });
  try {
    if (snapshot) {
      const result = await matchFace(snapshot);
      if (result === null) {
        const stmt = db.prepare('INSERT INTO attendance(username,role,date,subject,status,ts,snapshot) VALUES(?,?,?,?,?,?,?)');
        const snapBuf = Buffer.from((snapshot.split(',')[1] || ""), 'base64');
        stmt.run(username, role, date, subject, status, ts || Date.now(), snapBuf);
        return res.json({ ok: true, warning: 'face_service_unavailable' });
      }
      if (result.matched) {
        const threshold = 0.6;
        if (result.distance <= threshold && result.username && result.username.toLowerCase() === username.toLowerCase()) {
          const stmt = db.prepare('INSERT INTO attendance(username,role,date,subject,status,ts,snapshot) VALUES(?,?,?,?,?,?,?)');
          const snapBuf = Buffer.from((snapshot.split(',')[1] || ""), 'base64');
          stmt.run(username, role, date, subject, status, ts || Date.now(), snapBuf);
          return res.json({ ok: true, matched: true, distance: result.distance });
        } else {
          return res.status(400).json({ error: 'face_mismatch', matched: result, message: 'Face did not match enrolled user' });
        }
      } else {
        return res.status(400).json({ error: 'no_face_detected', details: result });
      }
    }

    // No snapshot - just record
    const stmt = db.prepare('INSERT INTO attendance(username,role,date,subject,status,ts,snapshot) VALUES(?,?,?,?,?,?,?)');
    stmt.run(username, role, date, subject, status, ts || Date.now(), null);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db error', details: e.message }); }
});

// Timetable endpoints
app.post('/api/timetable', (req, res) => {
  const { classroom, token, start, end } = req.body;
  if (!classroom || !token || !start || !end) return res.status(400).json({ error: 'missing fields' });
  try {
    const stmt = db.prepare('INSERT INTO timetable(classroom,token,start_ts,end_ts,created) VALUES(?,?,?,?,?)');
    stmt.run(classroom, token, Date.parse(start), Date.parse(end), Date.now());
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db error', details: e.message }); }
});

app.get('/api/timetable', (req, res) => {
  const rows = db.prepare('SELECT id, classroom,token,start_ts,end_ts,created FROM timetable ORDER BY start_ts DESC').all();
  res.json(rows.map(r => ({ ...r, start: new Date(r.start_ts).toISOString(), end: new Date(r.end_ts).toISOString() })));
});

// Active token(s)
app.get('/api/active-token', (req, res) => {
  const classroom = req.query.classroom || null;
  const now = Date.now();
  let rows;
  if (classroom) {
    rows = db.prepare('SELECT classroom,token,start_ts,end_ts FROM timetable WHERE classroom = ? AND start_ts <= ? AND end_ts >= ? ').all(classroom, now, now);
  } else {
    rows = db.prepare('SELECT classroom,token,start_ts,end_ts FROM timetable WHERE start_ts <= ? AND end_ts >= ? ').all(now, now);
  }
  res.json(rows.map(r => ({ classroom: r.classroom, token: r.token, start: new Date(r.start_ts).toISOString(), end: new Date(r.end_ts).toISOString() })));
});

// Lists for debugging
app.get('/api/students', (req, res) => {
  const rows = db.prepare('SELECT id,fullname,roll,username,created FROM students').all();
  res.json(rows);
});

app.get('/api/attendance', (req, res) => {
  const rows = db.prepare('SELECT id, username, role, date,subject,status,ts FROM attendance ORDER BY ts DESC').all();
  res.json(rows);
});

// Serve stored student photo (binary)
app.get('/api/student-photo/:username', (req, res) => {
  try {
    const row = db.prepare('SELECT photo FROM students WHERE username = ?').get(req.params.username);
    if (!row || !row.photo) return res.status(404).json({ error: 'no_photo' });
    res.set('Content-Type', 'image/png');
    res.send(row.photo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Serve stored attendance snapshot
app.get('/api/attendance-snapshot/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT snapshot FROM attendance WHERE id = ?').get(req.params.id);
    if (!row || !row.snapshot) return res.status(404).json({ error: 'no_snapshot' });
    res.set('Content-Type', 'image/png');
    res.send(row.snapshot);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Mirror whoami (second copy not needed if first exists)
// app.get('/api/whoami', (req, res) => {
//   console.log("Cookies:", req.cookies);
//   res.json({ allowed: checkIfAllowed(req) });
// });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Server running on', PORT));