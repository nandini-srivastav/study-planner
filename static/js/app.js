const API = window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000'
    : '';

// --- Pomodoro Timer ---
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroCount = 1;
let isBreak = false;
let isRunning = false;

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSeconds / 60);
    const secs = pomodoroSeconds % 60;
    document.getElementById('pomodoro-time').textContent =
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function pomodoroComplete() {
    if (!isBreak) {
        const subjectId = document.getElementById('pomodoro-subject').value;
        const msg = document.getElementById('pomodoro-message');
        if (subjectId) {
            const today = new Date().toISOString().split('T')[0];
            await fetch(`${API}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    subject_id: parseInt(subjectId),
                    duration_mins: 25,
                    date: today,
                    notes: `Pomodoro #${pomodoroCount}`
                })
            });
            loadSessions();
            loadDashboard();
            loadGoals();
            msg.textContent = `Pomodoro #${pomodoroCount} logged!`;
            setTimeout(() => { msg.textContent = ''; }, 3000);
        }
        isBreak = true;
        pomodoroSeconds = 5 * 60;
        document.getElementById('pomodoro-mode').textContent = 'Break';
        document.getElementById('pomodoro-time').classList.add('break');
        document.getElementById('pomodoro-count').textContent = `Break time!`;
    } else {
        pomodoroCount++;
        isBreak = false;
        pomodoroSeconds = 25 * 60;
        document.getElementById('pomodoro-mode').textContent = 'Focus';
        document.getElementById('pomodoro-time').classList.remove('break');
        document.getElementById('pomodoro-count').textContent = `Pomodoro #${pomodoroCount}`;
    }
    updatePomodoroDisplay();
}

function startPomodoro() {
    const btn = document.getElementById('btn-start');
    if (isRunning) {
        clearInterval(pomodoroInterval);
        isRunning = false;
        btn.textContent = 'Resume';
        return;
    }
    isRunning = true;
    btn.textContent = 'Pause';
    pomodoroInterval = setInterval(async () => {
        pomodoroSeconds--;
        updatePomodoroDisplay();
        if (pomodoroSeconds <= 0) {
            clearInterval(pomodoroInterval);
            isRunning = false;
            await pomodoroComplete();
            startPomodoro();
        }
    }, 1000);
}

function resetPomodoro() {
    clearInterval(pomodoroInterval);
    isRunning = false;
    isBreak = false;
    pomodoroSeconds = 25 * 60;
    pomodoroCount = 1;
    document.getElementById('btn-start').textContent = 'Start';
    document.getElementById('pomodoro-mode').textContent = 'Focus';
    document.getElementById('pomodoro-time').classList.remove('break');
    document.getElementById('pomodoro-count').textContent = 'Pomodoro #1';
    document.getElementById('pomodoro-message').textContent = '';
    updatePomodoroDisplay();
}

async function logout() {
    await fetch(`${API}/api/logout`, {
        method: 'POST',
        credentials: 'include'
    });
    window.location.href = '/login';
}

async function loadDashboard() {
    const res = await fetch(`${API}/stats`, { credentials: 'include' });
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
    const res = await fetch(`${API}/subjects`, { credentials: 'include' });
    const subjects = await res.json();
    const select = ['session-subject', 'pomodoro-subject'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '<option value="">Select subject...</option>';
        subjects.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    });
}

async function loadSessions() {
    const res = await fetch(`${API}/sessions`, { credentials: 'include' });
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
    const weekly_goal_mins = parseInt(document.getElementById('subject-goal').value) || 120;
    if (!name) return alert('Please enter a subject name');
    await fetch(`${API}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, colour, weekly_goal_mins})
    });
    document.getElementById('subject-name').value = '';
    loadSubjects();
    loadDashboard();
    loadGoals();
}

async function loadGoals() {
    const res = await fetch(`${API}/stats`, { credentials: 'include' });
    const stats = await res.json();
    const thisWeek = stats.this_week || [];
    const list = document.getElementById('goals-list');
    if (thisWeek.length === 0) {
        list.innerHTML = '<p class="empty">Add subjects to see your weekly goals.</p>';
        return;
    }
    list.innerHTML = thisWeek.map(s => {
        const pct = Math.min(100, Math.round((s.week_mins / s.weekly_goal_mins) * 100));
        const done = pct >= 100;
        const weekHours = (s.week_mins / 60).toFixed(1);
        const goalHours = (s.weekly_goal_mins / 60).toFixed(1);
        return `
            <div class="goal-item ${done ? 'goal-complete' : ''}">
                <div class="goal-header">
                    <span class="goal-subject">${s.name}</span>
                    <span class="goal-meta">${weekHours}h / ${goalHours}h ${done ? '✓ Done' : `(${pct}%)`}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${pct}%; background: ${s.colour}"></div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadHeatmap() {
    const res = await fetch(`${API}/heatmap`, { credentials: 'include' });
    const data = await res.json();

    const container = document.getElementById('heatmap-container');
    container.innerHTML = '';

    let tooltip = document.getElementById('heatmap-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'heatmap-tooltip';
        tooltip.className = 'heatmap-tooltip';
        document.body.appendChild(tooltip);
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    start.setDate(start.getDate() - start.getDay());

    const maxMins = Math.max(...Object.values(data), 1);

    function getColour(mins) {
        if (!mins) return '#eee';
        const intensity = mins / maxMins;
        if (intensity < 0.25) return '#c7d2fe';
        if (intensity < 0.5)  return '#818cf8';
        if (intensity < 0.75) return '#4F46E5';
        return '#3730a3';
    }

    const cursor = new Date(start);
    while (cursor <= today) {
        const week = document.createElement('div');
        week.className = 'heatmap-week';
        for (let d = 0; d < 7; d++) {
            const day = document.createElement('div');
            day.className = 'heatmap-day';
            const dateStr = cursor.toISOString().split('T')[0];
            const mins = data[dateStr] || 0;
            day.style.background = getColour(mins);

            if (cursor > today) {
                day.style.background = 'transparent';
            }

            day.addEventListener('mousemove', e => {
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 10) + 'px';
                tooltip.style.top = (e.clientY - 28) + 'px';
                tooltip.textContent = mins
                    ? `${dateStr}: ${mins} mins`
                    : `${dateStr}: no study`;
            });
            day.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

            week.appendChild(day);
            cursor.setDate(cursor.getDate() + 1);
        }
        container.appendChild(week);
    }
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
        credentials: 'include',
        body: JSON.stringify({ subject_id: parseInt(subject_id), duration_mins: parseInt(duration_mins), date, notes })
    });
    document.getElementById('session-duration').value = '';
    document.getElementById('session-notes').value = '';
    loadSessions();
    loadDashboard();
    loadGoals();
    loadHeatmap()
}

async function deleteSession(id) {
    await fetch(`${API}/sessions/${id}`, { method: 'DELETE' , credentials: 'include'});
    loadSessions();
    loadDashboard();
    loadGoals();
    loadHeatmap()
}

let studyChart = null;
loadSubjects();
loadSessions();
loadDashboard();
loadGoals();
loadHeatmap()