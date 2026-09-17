let tasksState = { page: 1, status: '', priority: '', sort: 'deadline' };
let taskSubjectsMap = {};

async function initTasksPage() {
  if (!requireAuth()) return;
  renderSidebar('tasks');
  renderMobileTopbar('Tasks');

  const subjSelect = document.getElementById('task-subject');
  const subjects = await populateSubjectSelect(subjSelect);
  taskSubjectsMap = Object.fromEntries(subjects.map((s) => [s._id, s]));

  document.getElementById('add-task-btn').addEventListener('click', () => openModal('task-modal'));
  document.getElementById('task-modal-close').addEventListener('click', () => closeModal('task-modal'));
  document.getElementById('task-cancel-btn').addEventListener('click', () => closeModal('task-modal'));
  document.getElementById('task-form').addEventListener('submit', handleCreateTask);

  document.getElementById('filter-status').addEventListener('change', (e) => {
    tasksState.status = e.target.value; tasksState.page = 1; loadTasks();
  });
  document.getElementById('filter-priority').addEventListener('change', (e) => {
    tasksState.priority = e.target.value; tasksState.page = 1; loadTasks();
  });
  document.getElementById('filter-sort').addEventListener('change', (e) => {
    tasksState.sort = e.target.value; tasksState.page = 1; loadTasks();
  });

  await loadTasks();
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set('page', tasksState.page);
  params.set('limit', 8);
  params.set('sort', tasksState.sort);
  if (tasksState.status) params.set('status', tasksState.status);
  if (tasksState.priority) params.set('priority', tasksState.priority);
  return `?${params.toString()}`;
}

async function loadTasks() {
  const container = document.getElementById('tasks-list');
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading tasks...</div>`;
  try {
    const res = await API.listTasks(buildQuery());
    renderTasks(res.data);
    renderPagination(document.getElementById('tasks-pagination'), res.pagination, (page) => {
      tasksState.page = page; loadTasks();
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h4>Failed to load tasks</h4><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-list');
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h4>No tasks found</h4><p>Try adjusting your filters, or add a new task.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="task-list">${tasks.map(renderTaskCard).join('')}</div>`;

  container.querySelectorAll('[data-toggle-complete]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.dataset.toggleComplete;
      const newStatus = el.dataset.currentStatus === 'Completed' ? 'Pending' : 'Completed';
      try {
        await API.updateTask(id, { status: newStatus });
        showToast(newStatus === 'Completed' ? 'Task marked complete!' : 'Task reopened', 'success');
        loadTasks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-delete-task]').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await API.deleteTask(el.dataset.deleteTask);
        showToast('Task deleted', 'success');
        loadTasks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-expand-task]').forEach((el) => {
    el.addEventListener('click', () => openTaskDetail(el.dataset.expandTask, tasks));
  });
}

function renderTaskCard(t) {
  const overdue = isOverdue(t.deadline, t.status);
  const subject = t.subjectId && taskSubjectsMap[t.subjectId] ? taskSubjectsMap[t.subjectId].name : null;
  const subtaskCount = t.subtasks?.length || 0;
  const subtaskDone = t.subtasks?.filter((s) => s.completed).length || 0;

  return `
  <div class="task-card ${t.status === 'Completed' ? 'completed' : ''}">
    <div class="task-check ${t.status === 'Completed' ? 'checked' : ''}" data-toggle-complete="${t._id}" data-current-status="${t.status}" style="cursor:pointer;"></div>
    <div class="task-main" data-expand-task="${t._id}" style="cursor:pointer;">
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
        <span class="badge badge-${t.status.toLowerCase().replace(' ', '-')}">${t.status}</span>
        ${subject ? `<span>${escapeHtml(subject)}</span>` : ''}
        <span class="${overdue ? 'overdue-flag' : ''}">${overdue ? 'Overdue · ' : ''}${formatDate(t.deadline)}</span>
        ${subtaskCount ? `<span>${subtaskDone}/${subtaskCount} subtasks</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-icon" data-delete-task="${t._id}" title="Delete">🗑</button>
    </div>
  </div>`;
}

async function handleCreateTask(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim();
  const deadline = document.getElementById('task-deadline').value;
  const priority = document.getElementById('task-priority').value;
  const subjectId = document.getElementById('task-subject').value || null;

  try {
    await API.createTask({ title, description, deadline, priority, subjectId });
    showToast('Task created', 'success');
    closeModal('task-modal');
    e.target.reset();
    tasksState.page = 1;
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Task detail / subtask management modal
let currentDetailTaskId = null;

async function openTaskDetail(taskId) {
  currentDetailTaskId = taskId;
  openModal('task-detail-modal');
  const body = document.getElementById('task-detail-body');
  body.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading...</div>`;
  try {
    const res = await API.getTask(taskId);
    renderTaskDetail(res.data);
  } catch (err) {
    body.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function renderTaskDetail(task) {
  const body = document.getElementById('task-detail-body');
  document.getElementById('task-detail-title').textContent = task.title;
  body.innerHTML = `
    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px;">${escapeHtml(task.description || 'No description.')}</p>
    <div class="section-title" style="font-size:0.85rem;">Subtasks</div>
    <div id="subtask-list">${(task.subtasks || [])
      .map(
        (s) => `
      <div class="subtask-row ${s.completed ? 'completed' : ''}">
        <input type="checkbox" data-subtask-toggle="${s._id}" ${s.completed ? 'checked' : ''}>
        <span>${escapeHtml(s.title)}</span>
        <button class="btn-icon" data-subtask-delete="${s._id}" style="margin-left:auto;">✕</button>
      </div>`
      )
      .join('') || '<p style="color:var(--text-muted); font-size:0.83rem;">No subtasks yet.</p>'}
    </div>
    <form id="add-subtask-form" style="display:flex; gap:8px; margin-top:14px;">
      <input class="form-control" id="new-subtask-title" placeholder="Add a subtask..." required>
      <button class="btn btn-secondary btn-sm" type="submit">Add</button>
    </form>
  `;

  body.querySelectorAll('[data-subtask-toggle]').forEach((el) => {
    el.addEventListener('change', async () => {
      try {
        await API.updateSubtask(task._id, el.dataset.subtaskToggle, { completed: el.checked });
        showToast('Subtask updated', 'success');
        openTaskDetail(task._id);
        loadTasks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  body.querySelectorAll('[data-subtask-delete]').forEach((el) => {
    el.addEventListener('click', async () => {
      try {
        await API.deleteSubtask(task._id, el.dataset.subtaskDelete);
        showToast('Subtask removed', 'success');
        openTaskDetail(task._id);
        loadTasks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.getElementById('add-subtask-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-subtask-title');
    try {
      await API.addSubtask(task._id, input.value.trim());
      input.value = '';
      openTaskDetail(task._id);
      loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
