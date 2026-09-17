// Actual functional Pomodoro timer. Runs via a single interval, unaffected by other UI interactions
// because state (mode, remainingSeconds, isRunning) is tracked independently of any DOM listeners.

const TIMER_DURATIONS = { Focus: 25 * 60, 'Short Break': 5 * 60, 'Long Break': 15 * 60 };
const CIRCLE_RADIUS = 110;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

let timerState = {
  mode: 'Focus',
  remainingSeconds: TIMER_DURATIONS.Focus,
  isRunning: false,
  intervalId: null,
  sessionCount: 0,
  subjectId: null
};

async function initTimerPage() {
  if (!requireAuth()) return;
  renderSidebar('timer');
  renderMobileTopbar('Study Timer');

  const subjSelect = document.getElementById('timer-subject');
  await populateSubjectSelect(subjSelect, false);
  timerState.subjectId = subjSelect.value || null;
  subjSelect.addEventListener('change', () => { timerState.subjectId = subjSelect.value || null; });

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', pauseTimer);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);

  buildTimerCircle();
  updateTimerDisplay();
  await loadTodayStudyTime();
}

function buildTimerCircle() {
  const svg = document.getElementById('timer-svg');
  svg.innerHTML = `
    <circle cx="130" cy="130" r="${CIRCLE_RADIUS}" fill="none" stroke="#e2e8f0" stroke-width="14"/>
    <circle id="timer-progress-ring" cx="130" cy="130" r="${CIRCLE_RADIUS}" fill="none" stroke="#6366f1" stroke-width="14"
      stroke-linecap="round" stroke-dasharray="${CIRCLE_CIRCUMFERENCE}" stroke-dashoffset="0"/>
  `;
}

function switchMode(mode) {
  if (timerState.isRunning) pauseTimer();
  timerState.mode = mode;
  timerState.remainingSeconds = TIMER_DURATIONS[mode];
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  updateTimerDisplay();
}

function startTimer() {
  if (timerState.isRunning) return;
  timerState.isRunning = true;
  document.getElementById('timer-start').disabled = true;
  document.getElementById('timer-pause').disabled = false;

  timerState.intervalId = setInterval(() => {
    timerState.remainingSeconds -= 1;
    if (timerState.remainingSeconds <= 0) {
      completeSession();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  timerState.isRunning = false;
  clearInterval(timerState.intervalId);
  document.getElementById('timer-start').disabled = false;
  document.getElementById('timer-pause').disabled = true;
}

function resetTimer() {
  pauseTimer();
  timerState.remainingSeconds = TIMER_DURATIONS[timerState.mode];
  updateTimerDisplay();
}

async function completeSession() {
  pauseTimer();
  timerState.remainingSeconds = 0;
  updateTimerDisplay();

  if (timerState.mode === 'Focus') {
    timerState.sessionCount += 1;
    document.getElementById('session-count').textContent = timerState.sessionCount;

    if (timerState.subjectId) {
      try {
        await API.createSession({
          subjectId: timerState.subjectId,
          mode: 'Focus',
          durationMinutes: Math.round(TIMER_DURATIONS.Focus / 60)
        });
        showToast('Focus session logged!', 'success');
        loadTodayStudyTime();
      } catch (err) {
        showToast(`Session finished, but failed to log: ${err.message}`, 'error');
      }
    } else {
      showToast('Focus session complete! Select a subject next time to log study time.', 'info');
    }
  } else {
    showToast(`${timerState.mode} finished!`, 'success');
  }

  timerState.remainingSeconds = TIMER_DURATIONS[timerState.mode];
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const total = TIMER_DURATIONS[timerState.mode];
  const remaining = timerState.remainingSeconds;
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = Math.floor(remaining % 60).toString().padStart(2, '0');
  document.getElementById('timer-time').textContent = `${mins}:${secs}`;
  document.getElementById('timer-mode-label').textContent = timerState.mode;

  const ring = document.getElementById('timer-progress-ring');
  if (ring) {
    const progress = 1 - remaining / total;
    ring.setAttribute('stroke-dashoffset', String(CIRCLE_CIRCUMFERENCE * progress));
  }
}

async function loadTodayStudyTime() {
  try {
    const res = await API.getDashboardAnalytics();
    document.getElementById('total-study-hours').textContent = `${res.data.study.totalHours}h`;
  } catch {
    // non-fatal
  }
}
