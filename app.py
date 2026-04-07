from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from database import get_db, init_db

app = Flask(__name__)
CORS(app)  # allows your frontend to talk to this backend

# --- Subjects ---

@app.route('/subjects', methods=['GET'])
def get_subjects():
    db = get_db()
    subjects = db.execute('SELECT * FROM subjects ORDER BY name').fetchall()
    db.close()
    return jsonify([dict(s) for s in subjects])

@app.route('/subjects', methods=['POST'])
def add_subject():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name is required'}), 400
    db = get_db()
    db.execute(
        'INSERT INTO subjects (name, colour) VALUES (?, ?)',
        (data['name'], data.get('colour', '#4F46E5'))
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Subject created'}), 201

@app.route('/subjects/<int:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    db = get_db()
    db.execute('DELETE FROM subjects WHERE id = ?', (subject_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Subject deleted'})

# --- Sessions ---

@app.route('/sessions', methods=['GET'])
def get_sessions():
    db = get_db()
    sessions = db.execute('''
        SELECT sessions.*, subjects.name as subject_name, subjects.colour
        FROM sessions
        JOIN subjects ON sessions.subject_id = subjects.id
        ORDER BY sessions.date DESC
    ''').fetchall()
    db.close()
    return jsonify([dict(s) for s in sessions])

@app.route('/sessions', methods=['POST'])
def add_session():
    data = request.get_json()
    if not data or not all(k in data for k in ['subject_id', 'duration_mins', 'date']):
        return jsonify({'error': 'subject_id, duration_mins and date are required'}), 400
    db = get_db()
    db.execute(
        'INSERT INTO sessions (subject_id, duration_mins, date, notes) VALUES (?, ?, ?, ?)',
        (data['subject_id'], data['duration_mins'], data['date'], data.get('notes', ''))
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Session logged'}), 201

@app.route('/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    db = get_db()
    db.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Session deleted'})

# --- Stats (for the dashboard on Day 5) ---

@app.route('/stats', methods=['GET'])
def get_stats():
    db = get_db()
    total = db.execute('SELECT SUM(duration_mins) as total FROM sessions').fetchone()
    by_subject = db.execute('''
        SELECT subjects.name, subjects.colour, SUM(sessions.duration_mins) as total_mins
        FROM sessions
        JOIN subjects ON sessions.subject_id = subjects.id
        GROUP BY subjects.id
        ORDER BY total_mins DESC
    ''').fetchall()
    db.close()
    return jsonify({
        'total_mins': total['total'] or 0,
        'by_subject': [dict(r) for r in by_subject]
    })
@app.route('/')
def index():
    return render_template('index.html')

# --- Run ---

if __name__ == '__main__':
    init_db()
    app.run(debug=True)