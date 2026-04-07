from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db
from functools import wraps

app = Flask(__name__)
app.secret_key = 'dev-secret-key-change-in-production'
CORS(app, supports_credentials=True)

with app.app_context():
    init_db()

# --- Auth decorator ---

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated

# --- Pages ---

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html', username=session['username'])

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

# --- Auth API ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not all(k in data for k in ['username', 'email', 'password']):
        return jsonify({'error': 'Username, email and password are required'}), 400
    db = get_db()
    existing = db.execute(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        (data['email'], data['username'])
    ).fetchone()
    if existing:
        db.close()
        return jsonify({'error': 'Username or email already exists'}), 400
    db.execute(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        (data['username'], data['email'], generate_password_hash(data['password']))
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Account created'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not all(k in data for k in ['email', 'password']):
        return jsonify({'error': 'Email and password are required'}), 400
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE email = ?', (data['email'],)).fetchone()
    db.close()
    if not user or not check_password_hash(user['password_hash'], data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'message': 'Logged in', 'username': user['username']})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

# --- Subjects ---

@app.route('/subjects', methods=['GET'])
@login_required
def get_subjects():
    db = get_db()
    subjects = db.execute(
        'SELECT * FROM subjects WHERE user_id = ? ORDER BY name',
        (session['user_id'],)
    ).fetchall()
    db.close()
    return jsonify([dict(s) for s in subjects])

@app.route('/subjects', methods=['POST'])
@login_required
def add_subject():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name is required'}), 400
    db = get_db()
    db.execute(
        'INSERT INTO subjects (user_id, name, colour, weekly_goal_mins) VALUES (?, ?, ?, ?)',
        (session['user_id'], data['name'], data.get('colour', '#4F46E5'), data.get('weekly_goal_mins', 120))
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Subject created'}), 201

@app.route('/subjects/<int:subject_id>', methods=['DELETE'])
@login_required
def delete_subject(subject_id):
    db = get_db()
    db.execute(
        'DELETE FROM subjects WHERE id = ? AND user_id = ?',
        (subject_id, session['user_id'])
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Subject deleted'})

@app.route('/subjects/<int:subject_id>', methods=['PUT'])
@login_required
def update_subject(subject_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        'UPDATE subjects SET weekly_goal_mins = ? WHERE id = ? AND user_id = ?',
        (data.get('weekly_goal_mins', 120), subject_id, session['user_id'])
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Subject updated'})

# --- Sessions ---

@app.route('/sessions', methods=['GET'])
@login_required
def get_sessions():
    db = get_db()
    sessions_data = db.execute('''
        SELECT sessions.*, subjects.name as subject_name, subjects.colour
        FROM sessions
        JOIN subjects ON sessions.subject_id = subjects.id
        WHERE subjects.user_id = ?
        ORDER BY sessions.date DESC
    ''', (session['user_id'],)).fetchall()
    db.close()
    return jsonify([dict(s) for s in sessions_data])

@app.route('/sessions', methods=['POST'])
@login_required
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
@login_required
def delete_session(session_id):
    db = get_db()
    db.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Session deleted'})

# --- Stats ---

@app.route('/stats', methods=['GET'])
@login_required
def get_stats():
    db = get_db()
    total = db.execute('''
        SELECT SUM(sessions.duration_mins) as total
        FROM sessions
        JOIN subjects ON sessions.subject_id = subjects.id
        WHERE subjects.user_id = ?
    ''', (session['user_id'],)).fetchone()
    by_subject = db.execute('''
        SELECT subjects.id, subjects.name, subjects.colour, subjects.weekly_goal_mins,
               SUM(sessions.duration_mins) as total_mins
        FROM sessions
        JOIN subjects ON sessions.subject_id = subjects.id
        WHERE subjects.user_id = ?
        GROUP BY subjects.id
        ORDER BY total_mins DESC
    ''', (session['user_id'],)).fetchall()
    
    this_week = db.execute('''
        SELECT subjects.id, subjects.name, subjects.colour, subjects.weekly_goal_mins,
               COALESCE(SUM(sessions.duration_mins), 0) as week_mins
        FROM subjects
        LEFT JOIN sessions ON sessions.subject_id = subjects.id
            AND sessions.date >= date('now', 'weekday 0', '-7 days')
        WHERE subjects.user_id = ?
        GROUP BY subjects.id
        ORDER BY subjects.name
    ''', (session['user_id'],)).fetchall()
    
    db.close()
    return jsonify({
        'total_mins': total['total'] or 0,
        'by_subject': [dict(r) for r in by_subject],
        'this_week': [dict(r) for r in this_week]
    })

# --- Run ---

if __name__ == '__main__':
    app.run(debug=True)