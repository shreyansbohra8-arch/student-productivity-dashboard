async function initDashboardPage() {
  if (!requireAuth()) return;
  renderSidebar('dashboard');
  renderMobileTopbar('Dashboard');

  const user = getStoredUser();
  document.getElementById('welcome-name').textContent = user?.name?.split(' ')[0] || 'there';
  document.getElementById('current-date').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const content = document.getElementById('dashboard-content');
  content.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading your dashboard...</div>`;

  try {
    const [analyticsRes, tasksRes] = await Promise.all([
      API.getDashboardAnalytics(),
      API.listTasks('?limit=5&sort=deadline')
    ]);
    renderDashboard(analyticsRes.data, tasksRes.data);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Couldn't load dashboard</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderDashboard(a, recentTasks) {
  const content = document.getElementById('dashboard-content');

  content.innerHTML = `
    <div class="stat-grid">
      <div class="card stat-card streak-card">
        <div class="stat-label">Productivity Streak</div>
        <div class="stat-value">${a.streak.current}<span class="streak-unit"> days</span></div>
        <div class="stat-sub">${a.streak.todayProductive ? 'Active today - keep it going!' : a.streak.current > 0 ? 'Log a session or task today to keep it alive.' : 'Log a session or complete a task to start one.'}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Daily Study Goal</div>
        <div class="stat-value">${Math.floor(a.study.dailyGoal.studiedMinutes / 60)}h ${a.study.dailyGoal.studiedMinutes % 60}m</div>
        <div class="stat-sub">
          ${a.study.dailyGoal.percentage}% of ${Math.floor(a.study.dailyGoal.goalMinutes / 60)}h goal ·
          ${a.study.dailyGoal.remainingMinutes > 0
            ? `${Math.floor(a.study.dailyGoal.remainingMinutes / 60)}h ${a.study.dailyGoal.remainingMinutes % 60}m remaining`
            : 'Goal completed! 🎉'}
        </div>

        <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
          <label for="daily-goal-input" style="font-size:0.8rem;">Set goal:</label>
          <input
            type="number"
            id="daily-goal-input"
            min="0.5"
            max="24"
            step="0.5"
            value="${a.study.dailyGoal.goalMinutes / 60}"
            style="width:70px; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px;"
          >
          <span style="font-size:0.8rem;">hours</span>
          <button
            type="button"
            id="save-daily-goal"
            class="btn btn-primary btn-sm"
          >
            Save
          </button>
        </div>

        <div id="daily-goal-message" style="font-size:0.75rem; margin-top:6px;"></div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Tasks Completed</div>
        <div class="stat-value">${a.tasks.completedTasks}/${a.tasks.totalTasks}</div>
        <div class="stat-sub">${a.tasks.completionPercentage}% completion rate</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Pending Tasks</div>
        <div class="stat-value">${a.tasks.pendingTasks}</div>
        <div class="stat-sub">${a.tasks.overdueTasks} overdue</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Attendance</div>
        <div class="stat-value">${a.attendance.overallPercentage}%</div>
        <div class="stat-sub">${a.attendance.belowThreshold.length} subject(s) below threshold</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Study Hours</div>
        <div class="stat-value">${a.study.totalHours}h</div>
        <div class="stat-sub">${a.study.totalSessions} sessions logged</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="section-title">Recent Tasks</div>
        ${renderMiniTaskList(recentTasks)}
      </div>
      <div class="card">
        <div class="section-title">Upcoming Exams</div>
        ${renderMiniExamList(a.exams.upcoming)}
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div class="card">
        <div class="section-title">Attendance Overview</div>
        ${renderMiniAttendance(a.attendance.bySubject)}
      </div>
      <div class="card">
        <div class="section-title">Study Time by Subject</div>
        ${renderMiniStudy(a.study.bySubject)}
      </div>
    </div>
  `;
  const saveGoalBtn = document.getElementById('save-daily-goal');
  const goalInput = document.getElementById('daily-goal-input');
  const goalMessage = document.getElementById('daily-goal-message');

  saveGoalBtn?.addEventListener('click', async () => {
    const hours = Number(goalInput.value);

    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) {
      goalMessage.textContent = 'Please enter a goal between 0.5 and 24 hours.';
      return;
    }

    const minutes = Math.round(hours * 60);

    saveGoalBtn.disabled = true;
    saveGoalBtn.textContent = 'Saving...';
    goalMessage.textContent = '';

    try {
      const res = await API.updateSettings({
        dailyStudyGoalMinutes: minutes
      });

      setStoredUser(res.data.user);

      goalMessage.textContent = 'Daily study goal saved!';
      saveGoalBtn.textContent = 'Saved';

      setTimeout(() => {
        saveGoalBtn.textContent = 'Save';
      }, 1500);

      // Refresh the dashboard so the progress display uses the new goal.
      const analyticsRes = await API.getDashboardAnalytics();
      renderDashboard(analyticsRes.data, recentTasks);
    } catch (err) {
      goalMessage.textContent = err.message;
      saveGoalBtn.textContent = 'Save';
    } finally {
      saveGoalBtn.disabled = false;
    }
  });
}

function renderMiniTaskList(tasks) {
  if (!tasks.length) return `<div class="empty-state"><div class="empty-icon">📋</div><h4>No tasks yet</h4><p>Create your first task to get started.</p></div>`;
  return `<div class="mini-list">${tasks
    .map(
      (t) => `
    <div class="mini-list-row">
      <span>${escapeHtml(t.title)} ${isOverdue(t.deadline, t.status) ? '<span class="overdue-flag">overdue</span>' : ''}</span>
      <span class="badge badge-${t.status.toLowerCase().replace(' ', '-')}">${t.status}</span>
    </div>`
    )
    .join('')}</div>`;
}

function renderMiniExamList(exams) {
  if (!exams.length) return `<div class="empty-state"><div class="empty-icon">🗓️</div><h4>No upcoming exams</h4></div>`;
  return `<div class="mini-list">${exams
    .map(
      (e) => `
    <div class="mini-list-row">
      <span>${escapeHtml(e.examName)}</span>
      <span class="badge badge-medium">${formatDate(e.examDate)}</span>
    </div>`
    )
    .join('')}</div>`;
}

function renderMiniAttendance(list) {
  if (!list.length) return `<div class="empty-state"><div class="empty-icon">📊</div><h4>No attendance recorded</h4></div>`;
  return list
    .map((s) => {
      const state = s.percentage >= 75 ? 'safe' : s.percentage >= 65 ? 'warning' : 'shortage';
      return `
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;">
          <span>${escapeHtml(s.subjectName || 'Subject')}</span><strong>${s.percentage}%</strong>
        </div>
        <div class="progress-track"><div class="progress-fill ${state}" style="width:${s.percentage}%"></div></div>
      </div>`;
    })
    .join('');
}

function renderMiniStudy(list) {
  if (!list.length) return `<div class="empty-state"><div class="empty-icon">⏱️</div><h4>No study sessions logged</h4></div>`;
  const max = Math.max(...list.map((s) => s.totalMinutes), 1);
  return list
    .map(
      (s) => `
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;">
        <span>${escapeHtml(s.subjectName)}</span><strong>${s.totalHours}h</strong>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${(s.totalMinutes / max) * 100}%; background:${s.color || '#6366f1'}"></div></div>
    </div>`
    )
    .join('');
}
