async function initAttendancePage() {
  if (!requireAuth()) return;
  renderSidebar('attendance');
  renderMobileTopbar('Attendance');

  await loadAttendance();
}

async function loadAttendance() {
  const container = document.getElementById('attendance-list');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading attendance...</div>`;
  try {
    const [attRes, subjRes] = await Promise.all([API.listAttendance(), API.listSubjects()]);
    renderAttendance(attRes.data, attRes.threshold, subjRes.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load attendance</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderAttendance(records, threshold, subjects) {
  const container = document.getElementById('attendance-list');
  document.getElementById('threshold-note').textContent = `Attendance threshold: ${threshold}%`;

  const recordedSubjectIds = new Set(records.map((r) => r.subjectId?._id || r.subjectId));
  const unrecorded = subjects.filter((s) => !recordedSubjectIds.has(s._id));

  let html = '<div class="grid-3">';

  html += records
    .map((r) => {
      const subj = r.subjectId || { name: 'Unknown', color: '#94a3b8' };
      return `
    <div class="subject-attendance-card">
      <div class="row-top">
        <h4>${escapeHtml(subj.name)}</h4>
        <span class="pct" style="color:${r.percentage >= threshold ? 'var(--success)' : r.percentage >= threshold - 10 ? 'var(--warning)' : 'var(--danger)'}">${r.percentage}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${r.state}" style="width:${r.percentage}%"></div></div>
      <p style="font-size:0.78rem; color:var(--text-muted); margin-top:8px;">${r.presentClasses} present / ${r.totalClasses} total classes</p>
      ${r.canMiss !== null && r.canMiss !== undefined
        ? r.needToAttend > 0
          ? `<div class="attendance-calc calc-warning"><span><strong>⚠ Need to attend next ${r.needToAttend} class${r.needToAttend === 1 ? '' : 'es'}</strong> to reach ${threshold}%</span></div>`
          : `<div class="attendance-calc calc-safe"><span>✔ Can miss <strong>${r.canMiss}</strong> class${r.canMiss === 1 ? '' : 'es'}</span><span class="calc-keep">Need to attend next: ${r.needToAttend}</span></div>`
        : ''}
      ${r.state === 'shortage' ? `<p style="font-size:0.78rem; color:var(--danger); font-weight:600; margin-top:4px;">⚠ Attendance shortage</p>` : ''}
      ${r.state === 'warning' ? `<p style="font-size:0.78rem; color:var(--warning); font-weight:600; margin-top:4px;">⚠ Getting close to the limit</p>` : ''}
      <div class="attendance-actions">
        <button class="btn btn-secondary btn-sm" data-mark="${subj._id}" data-status="Present">Mark Present</button>
        <button class="btn btn-secondary btn-sm" data-mark="${subj._id}" data-status="Absent">Mark Absent</button>
      </div>
    </div>`;
    })
    .join('');

  html += unrecorded
    .map(
      (s) => `
    <div class="subject-attendance-card">
      <div class="row-top"><h4>${escapeHtml(s.name)}</h4><span class="pct">—</span></div>
      <p style="font-size:0.8rem; color:var(--text-muted);">No attendance recorded yet.</p>
      <div class="attendance-actions">
        <button class="btn btn-secondary btn-sm" data-mark="${s._id}" data-status="Present">Mark Present</button>
        <button class="btn btn-secondary btn-sm" data-mark="${s._id}" data-status="Absent">Mark Absent</button>
      </div>
    </div>`
    )
    .join('');

  html += '</div>';

  if (!records.length && !unrecorded.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h4>No subjects yet</h4><p>Add a subject first to start tracking attendance.</p></div>`;
    return;
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-mark]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await API.markAttendance(btn.dataset.mark, btn.dataset.status);
        showToast(`Marked ${btn.dataset.status}`, 'success');
        loadAttendance();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
