async function initExamsPage() {
  if (!requireAuth()) return;
  renderSidebar('exams');
  renderMobileTopbar('Exams');

  const subjSelect = document.getElementById('exam-subject');
  await populateSubjectSelect(subjSelect);

  document.getElementById('add-exam-btn').addEventListener('click', () => openModal('exam-modal'));
  document.getElementById('exam-modal-close').addEventListener('click', () => closeModal('exam-modal'));
  document.getElementById('exam-cancel-btn').addEventListener('click', () => closeModal('exam-modal'));
  document.getElementById('exam-form').addEventListener('submit', handleCreateExam);

  await loadExams();
}

async function loadExams() {
  const container = document.getElementById('exams-grid');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading exams...</div>`;
  try {
    const res = await API.listExams();
    renderExams(res.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load exams</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderExams(exams) {
  const container = document.getElementById('exams-grid');
  if (!exams.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div><h4>No exams scheduled</h4><p>Add an exam to start the countdown.</p></div>`;
    return;
  }
  container.className = 'exam-grid';
  container.innerHTML = exams
    .map((e) => {
      const pillClass = e.state === 'passed' ? 'badge-completed' : e.state === 'today' ? 'badge-urgent' : 'badge-medium';
      return `
    <div class="exam-card">
      <span class="countdown-pill badge ${pillClass}">${e.countdownLabel}</span>
      <h4>${escapeHtml(e.examName)}</h4>
      <div class="exam-date">${formatDate(e.examDate)}${e.subjectId ? ' · ' + escapeHtml(e.subjectId.name) : ''}</div>
      ${e.description ? `<p style="font-size:0.83rem; color:var(--text-muted); margin-bottom:10px;">${escapeHtml(e.description)}</p>` : ''}
      <button class="btn btn-danger btn-sm" data-delete-exam="${e._id}">Delete</button>
    </div>`;
    })
    .join('');

  container.querySelectorAll('[data-delete-exam]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this exam?')) return;
      try {
        await API.deleteExam(btn.dataset.deleteExam);
        showToast('Exam deleted', 'success');
        loadExams();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function handleCreateExam(e) {
  e.preventDefault();
  const examName = document.getElementById('exam-name').value.trim();
  const examDate = document.getElementById('exam-date').value;
  const description = document.getElementById('exam-description').value.trim();
  const subjectId = document.getElementById('exam-subject').value || null;

  try {
    await API.createExam({ examName, examDate, description, subjectId });
    showToast('Exam added', 'success');
    closeModal('exam-modal');
    e.target.reset();
    loadExams();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
