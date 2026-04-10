# Study Planner

A full-stack productivity web app for university students to track study sessions, set weekly goals, and plan for exams.

**Live demo:** https://study-planner-n7r4.onrender.com

## Features

- User authentication (register, login, logout)
- Track study sessions across multiple subjects
- Weekly study goals with progress bars
- Pomodoro timer with auto session logging
- Dashboard with Chart.js visualisation
- GitHub-style 90-day activity heatmap
- Exam countdowns with urgency indicators
- AI-powered study plan generator from syllabus PDF (Google Gemini)

## Tech stack

- **Backend:** Python, Flask, SQLite
- **Frontend:** HTML, CSS, vanilla JavaScript
- **AI:** Google Gemini API
- **Deployment:** Render

## Running locally

```bash
git clone https://github.com/nandini-srivastav/study-planner.git
cd study-planner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY='your-key-here'
python3 app.py
```