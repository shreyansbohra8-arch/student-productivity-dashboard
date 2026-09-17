let allSubjects = [];

async function initSubjectsPage() {
  if (!requireAuth()) return;
  renderSidebar('subjects');
  renderMobileTopbar('Subjects');

  document.getElementById('add-subject-btn').addEventListener('click', () => openModal('subject-modal'));
  document.getElementById('subject-modal-close').addEventListener('click', () => closeModal('subject-modal'));
  document.getElementById('subject-cancel-btn').addEventListener('click', () => closeModal('subject-modal'));
  document.getElementById('subject-form').addEventListener('submit', handleCreateSubject);

  await loadSubjects();
}

async function loadSubjects() {
  const container = document.getElementById('subjects-list');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading subjects...</div>`;
  try {
    const res = await API.listSubjects();
    allSubjects = res.data;
    renderSubjects(allSubjects);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load subjects</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderSubjects(subjects) {
  const container = document.getElementById('subjects-list');
  if (!subjects.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h4>No subjects yet</h4><p>Add a subject to start tracking tasks and attendance.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="grid-3">${subjects
    .map(
      (s) => `
    <div class="card">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="width:14px;height:14px;border-radius:4px;background:${s.color};display:inline-block;"></span>
        <strong>${escapeHtml(s.name)}</strong>
      </div>
      <p style="color:var(--text-muted); font-size:0.82rem; margin-bottom:12px;">${escapeHtml(s.code || 'No code')}</p>
      <button class="btn btn-danger btn-sm" data-delete="${s._id}">Delete</button>
    </div>`
    )
    .join('')}</div>`;

  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this subject? This does not delete related tasks/notes.')) return;
      try {
        await API.deleteSubject(btn.dataset.delete);
        showToast('Subject deleted', 'success');
        await loadSubjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function handleCreateSubject(e) {
  e.preventDefault();
  const name = document.getElementById('subject-name').value.trim();
  const code = document.getElementById('subject-code').value.trim();
  const color = document.getElementById('subject-color').value;
  try {
    await API.createSubject({ name, code, color });
    showToast('Subject added', 'success');
    closeModal('subject-modal');
    e.target.reset();
    await loadSubjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Helper reused by other pages to populate a <select> with subjects
async function populateSubjectSelect(selectEl, includeEmpty = true) {
  try {
    const res = await API.listSubjects();
    selectEl.innerHTML =
      (includeEmpty ? '<option value="">No subject</option>' : '') +
      res.data.map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`).join('');
    return res.data;
  } catch {
    selectEl.innerHTML = '<option value="">Unable to load subjects</option>';
    return [];
  }
}
