const API = 'http://127.0.0.1:5000';
let studyChart = null;

async function loadDashboard() {
    const res = await fetch(`${API}/stats`);
    const stats = await res.json();

    const totalMins = stats.total_mins || 0;
    const bySubject = stats.by_subject || [];

    document.getElementById('total-hours').textContent =
        (totalMins / 60).toFixed(1);
    document.getElementById('total-sessions').textContent =
        bySubject.reduce((sum, s) => sum + 1, 0);
    document.getElementById('top-subject').textContent =
        bySubject.length > 0 ? bySubject[0].name : '—';

    const labels = bySubject.map(s => s.name);
    const data = bySubject.map(s => parseFloat((s.total_mins / 60).toFixed(1)));
    const colours = bySubject.map(s => s.colour);

    if (studyChart) studyChart.destroy();

    const ctx = document.getElementById('studyChart').getContext('2d');
    studyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Hours studied',
                data,
                backgroundColor: colours,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                }
            }
        }
    });
}

async function loadSubjects() {
    const res = await fetch(`${API}/subjects`);
    const subjects = await res.json();
    const select = document.getElementById('session-subject');
    select.innerHTML = '<option value="">Select subject...</option>';
    subjects.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
}

async function loadSessions() {
    const res = await fetch(`${API}/sessions`);
    const sessions = await res.json();
    const list = document.getElementById('sessions-list');
    if (sessions.length === 0) {
        list.innerHTML = '<p class="empty">No sessions logged yet.</p>';
        return;
    }
    list.innerHTML = sessions.map(s => `
        <div class="session-item" style="border-left-color: ${s.colour}">
            <div class="session-info">
                <span class="session-subject">${s.subject_name}</span>
                <span class="session-meta">${s.duration_mins} mins · ${s.date}${s.notes ? ' · ' + s.notes : ''}</span>
            </div>
            <button class="delete-btn" onclick="deleteSession(${s.id})">✕</button>
        </div>
    `).join('');
}

async function addSubject() {
    const name = document.getElementById('subject-name').value.trim();
    const colour = document.getElementById('subject-colour').value;
    if (!name) return alert('Please enter a subject name');
    await fetch(`${API}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, colour })
    });
    document.getElementById('subject-name').value = '';
    loadSubjects();
    loadDashboard();
}

async function addSession() {
    const subject_id = document.getElementById('session-subject').value;
    const duration_mins = document.getElementById('session-duration').value;
    const date = document.getElementById('session-date').value;
    const notes = document.getElementById('session-notes').value.trim();
    if (!subject_id || !duration_mins || !date) return alert('Please fill in subject, duration and date');
    await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: parseInt(subject_id), duration_mins: parseInt(duration_mins), date, notes })
    });
    document.getElementById('session-duration').value = '';
    document.getElementById('session-notes').value = '';
    loadSessions();
    loadDashboard();
}

async function deleteSession(id) {
    await fetch(`${API}/sessions/${id}`, { method: 'DELETE' });
    loadSessions();
    loadDashboard();
}

loadSubjects();
loadSessions();
loadDashboard();