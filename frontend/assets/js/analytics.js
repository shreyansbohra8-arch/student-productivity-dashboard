let charts = {};

async function initAnalyticsPage() {
  if (!requireAuth()) return;
  renderSidebar('analytics');
  renderMobileTopbar('Analytics');

  const container = document.getElementById('analytics-content');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Crunching your analytics...</div>`;

  try {
    const res = await API.getDashboardAnalytics();
    renderAnalytics(res.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load analytics</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderAnalytics(a) {
  const container = document.getElementById('analytics-content');
  container.innerHTML = `
    <div class="stat-grid">
      <div class="card stat-card"><div class="stat-label">Task Completion</div><div class="stat-value">${a.tasks.completionPercentage}%</div><div class="stat-sub">${a.tasks.completedTasks}/${a.tasks.totalTasks} tasks</div></div>
      <div class="card stat-card"><div class="stat-label">Study Hours</div><div class="stat-value">${a.study.totalHours}h</div><div class="stat-sub">${a.study.totalSessions} sessions</div></div>
      <div class="card stat-card"><div class="stat-label">Overall Attendance</div><div class="stat-value">${a.attendance.overallPercentage}%</div><div class="stat-sub">${a.attendance.belowThreshold.length} below threshold</div></div>
      <div class="card stat-card"><div class="stat-label">Most Productive Day</div><div class="stat-value" style="font-size:1.2rem;">${a.study.mostProductiveDay || '—'}</div><div class="stat-sub">${a.study.mostProductiveSubject ? 'Top subject: ' + escapeHtml(a.study.mostProductiveSubject.subjectName) : ''}</div></div>
    </div>

    <div class="grid-2">
      <div class="card chart-card">
        <div class="section-title">Study Time by Subject</div>
        <canvas id="chart-study-subject" height="220"></canvas>
      </div>
      <div class="card chart-card">
        <div class="section-title">Task Status Breakdown</div>
        <canvas id="chart-task-status" height="220"></canvas>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div class="card chart-card">
        <div class="section-title">Attendance by Subject</div>
        <canvas id="chart-attendance" height="220"></canvas>
      </div>
      <div class="card chart-card">
        <div class="section-title">Study Trend (Last 14 Days)</div>
        <canvas id="chart-study-trend" height="220"></canvas>
      </div>
    </div>
  `;

  renderStudySubjectChart(a.study.bySubject);
  renderTaskStatusChart(a.tasks);
  renderAttendanceChart(a.attendance.bySubject);
  renderStudyTrendChart(a.study.trend);
}

function destroyIfExists(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function renderStudySubjectChart(data) {
  const ctx = document.getElementById('chart-study-subject');
  destroyIfExists('studySubject');
  if (!data.length) { ctx.parentElement.innerHTML += '<div class="empty-state"><p>No study sessions logged yet.</p></div>'; return; }
  charts.studySubject = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.subjectName),
      datasets: [{ data: data.map((d) => d.totalHours), backgroundColor: data.map((d) => d.color || '#6366f1') }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

function renderTaskStatusChart(tasks) {
  const ctx = document.getElementById('chart-task-status');
  destroyIfExists('taskStatus');
  charts.taskStatus = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Completed', 'Pending', 'Overdue'],
      datasets: [{
        data: [tasks.completedTasks, tasks.pendingTasks, tasks.overdueTasks],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444']
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

function renderAttendanceChart(data) {
  const ctx = document.getElementById('chart-attendance');
  destroyIfExists('attendance');
  if (!data.length) { ctx.parentElement.innerHTML += '<div class="empty-state"><p>No attendance recorded yet.</p></div>'; return; }
  charts.attendance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.subjectName || 'Subject'),
      datasets: [{ data: data.map((d) => d.percentage), backgroundColor: '#6366f1' }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 100 } } }
  });
}

function renderStudyTrendChart(trend) {
  const ctx = document.getElementById('chart-study-trend');
  destroyIfExists('studyTrend');
  if (!trend.length) { ctx.parentElement.innerHTML += '<div class="empty-state"><p>No recent study activity.</p></div>'; return; }
  charts.studyTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map((d) => d.date),
      datasets: [{ label: 'Minutes studied', data: trend.map((d) => d.totalMinutes), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}
