#!/usr/bin/env python3
from flask import Flask, request, jsonify
import sqlite3
import os
import base64
import io
from PIL import Image
import json
import numpy as np

# This service requires the `face_recognition` library (which depends on dlib).
# Install instructions are in README. This service computes face encodings and stores them.

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'face_service.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS encodings(
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 username TEXT,
                 encoding TEXT,
                 created INTEGER)''')
    conn.commit()
    conn.close()

init_db()

try:
    import face_recognition
except Exception as e:
    print('face_recognition import failed:', e)
    face_recognition = None


def dataurl_to_image(dataurl):
    # dataurl like 'data:image/jpeg;base64,/9j/4AAQ...'
    header, b64 = dataurl.split(',',1)
    data = base64.b64decode(b64)
    return Image.open(io.BytesIO(data)).convert('RGB')

@app.route('/enroll', methods=['POST'])
def enroll():
    if face_recognition is None:
        return jsonify({'error':'face_recognition not available on server'}), 500
    data = request.get_json() or {}
    username = data.get('username')
    photo = data.get('photo')
    if not username or not photo:
        return jsonify({'error':'missing fields'}), 400
    try:
        img = dataurl_to_image(photo)
        arr = np.array(img)
        encs = face_recognition.face_encodings(arr)
        if not encs:
            return jsonify({'error':'no face found'}), 400
        enc = encs[0].tolist()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('INSERT INTO encodings(username,encoding,created) VALUES(?,?,?)', (username, json.dumps(enc), int(__import__('time').time()*1000)))
        conn.commit()
        conn.close()
        return jsonify({'ok':True})
    except Exception as e:
        return jsonify({'error':'processing error','details':str(e)}), 500

@app.route('/match', methods=['POST'])
def match():
    if face_recognition is None:
        return jsonify({'error':'face_recognition not available on server'}), 500
    data = request.get_json() or {}
    photo = data.get('photo')
    if not photo:
        return jsonify({'error':'missing photo'}), 400
    try:
        img = dataurl_to_image(photo)
        arr = np.array(img)
        encs = face_recognition.face_encodings(arr)
        if not encs:
            return jsonify({'matched':False,'reason':'no_face'}), 200
        probe = encs[0]
        # load all encodings
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        rows = c.execute('SELECT username,encoding FROM encodings').fetchall()
        conn.close()
        best = None
        best_dist = None
        for username, enc_json in rows:
            stored = np.array(json.loads(enc_json))
            dist = float(np.linalg.norm(stored - probe))
            if best is None or dist < best_dist:
                best = username
                best_dist = dist
        if best is None:
            return jsonify({'matched':False,'reason':'no_db'}), 200
        return jsonify({'matched':True,'username':best,'distance':best_dist}), 200
    except Exception as e:
        return jsonify({'error':'processing error','details':str(e)}), 500

@app.route('/encodings', methods=['GET'])
def enc_list():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    rows = c.execute('SELECT id,username,created FROM encodings').fetchall()
    conn.close()
    out = [{'id':r[0],'username':r[1],'created':r[2]} for r in rows]
    return jsonify(out)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
