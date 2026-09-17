let notesState = { page: 1, q: '', subjectId: '' };
let notesSubjectMap = {};

async function initNotesPage() {
  if (!requireAuth()) return;
  renderSidebar('notes');
  renderMobileTopbar('Notes');

  const subjSelect = document.getElementById('note-subject');
  const filterSubjSelect = document.getElementById('filter-note-subject');
  const subjects = await populateSubjectSelect(subjSelect);
  notesSubjectMap = Object.fromEntries(subjects.map((s) => [s._id, s]));
  filterSubjSelect.innerHTML = '<option value="">All subjects</option>' + subjects.map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`).join('');

  document.getElementById('add-note-btn').addEventListener('click', () => openModal('note-modal'));
  document.getElementById('note-modal-close').addEventListener('click', () => closeModal('note-modal'));
  document.getElementById('note-cancel-btn').addEventListener('click', () => closeModal('note-modal'));
  document.getElementById('note-form').addEventListener('submit', handleCreateNote);

  let searchTimeout;
  document.getElementById('note-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      notesState.q = e.target.value.trim();
      notesState.page = 1;
      loadNotes();
    }, 350);
  });

  filterSubjSelect.addEventListener('change', (e) => {
    notesState.subjectId = e.target.value;
    notesState.page = 1;
    loadNotes();
  });

  await loadNotes();
}

function buildNotesQuery() {
  const params = new URLSearchParams();
  params.set('page', notesState.page);
  params.set('limit', 9);
  if (notesState.q) params.set('q', notesState.q);
  if (notesState.subjectId) params.set('subjectId', notesState.subjectId);
  return `?${params.toString()}`;
}

async function loadNotes() {
  const container = document.getElementById('notes-grid');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading notes...</div>`;
  try {
    const res = await API.listNotes(buildNotesQuery());
    renderNotes(res.data);
    renderPagination(document.getElementById('notes-pagination'), res.pagination, (page) => {
      notesState.page = page; loadNotes();
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load notes</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderNotes(notes) {
  const container = document.getElementById('notes-grid');
  if (!notes.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗒️</div><h4>No notes found</h4><p>${notesState.q ? `No results for "${escapeHtml(notesState.q)}".` : 'Create your first note.'}</p></div>`;
    return;
  }
  container.className = 'notes-grid';
  container.innerHTML = notes
    .map((n) => {
      const subj = n.subjectId && notesSubjectMap[n.subjectId] ? notesSubjectMap[n.subjectId].name : null;
      return `
    <div class="note-card">
      <h4>${escapeHtml(n.title)}</h4>
      <p>${escapeHtml(n.content)}</p>
      ${n.tags?.length ? `<div class="tag-list">${n.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="note-footer">
        <span>${subj ? escapeHtml(subj) : 'General'}</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-icon" data-delete-note="${n._id}">🗑</button>
        </div>
      </div>
    </div>`;
    })
    .join('');

  container.querySelectorAll('[data-delete-note]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this note?')) return;
      try {
        await API.deleteNote(btn.dataset.deleteNote);
        showToast('Note deleted', 'success');
        loadNotes();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function handleCreateNote(e) {
  e.preventDefault();
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  const subjectId = document.getElementById('note-subject').value || null;
  const tagsRaw = document.getElementById('note-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  try {
    await API.createNote({ title, content, subjectId, tags });
    showToast('Note created', 'success');
    closeModal('note-modal');
    e.target.reset();
    notesState.page = 1;
    loadNotes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
