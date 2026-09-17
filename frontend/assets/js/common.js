// Shared UI utilities used across all pages: toasts, modals, sidebar, date formatting.

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(deadline, status) {
  return status !== 'Completed' && new Date(deadline) < new Date();
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Renders the sidebar shell into any element with id="sidebar-root", and highlights the active page.
function renderSidebar(activePage) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;
  const user = getStoredUser() || { name: 'Student', email: '' };

  const links = [
    { page: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { page: 'tasks', href: 'tasks.html', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { page: 'attendance', href: 'attendance.html', label: 'Attendance', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { page: 'timer', href: 'timer.html', label: 'Study Timer', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { page: 'notes', href: 'notes.html', label: 'Notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { page: 'exams', href: 'exams.html', label: 'Exams', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { page: 'analytics', href: 'analytics.html', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { page: 'subjects', href: 'subjects.html', label: 'Subjects', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 5.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
  ];

  root.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand"><span class="logo-dot"></span> Productivity Hub</div>
      <nav class="sidebar-nav">
        ${links
          .map(
            (l) => `
          <a class="sidebar-link ${l.page === activePage ? 'active' : ''}" href="${l.href}">
            <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${l.icon}"/></svg></span>
            ${l.label}
          </a>`
          )
          .join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar">${initials(user.name)}</div>
          <div class="sidebar-user-info">
            <div class="name">${escapeHtml(user.name)}</div>
            <div class="email">${escapeHtml(user.email)}</div>
          </div>
        </div>
        <button class="logout-btn" id="logout-btn">Log out</button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearToken();
    location.href = 'login.html';
  });

  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
  });
}

function renderMobileTopbar(title) {
  const root = document.getElementById('mobile-topbar-root');
  if (!root) return;
  root.innerHTML = `
    <div class="mobile-topbar">
      <button id="hamburger-btn" aria-label="Open menu">&#9776;</button>
      <strong>${escapeHtml(title)}</strong>
      <span style="width:24px"></span>
    </div>
  `;
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('open');
  });
}

// Guards a page: redirects to login if not authenticated. Call at the top of each protected page's script.
function requireAuth() {
  if (!getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function renderPagination(container, pagination, onPageClick) {
  if (!container) return;
  const { currentPage, totalPages } = pagination;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">&laquo; Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button data-page="${i}" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
  }
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next &raquo;</button>`;
  container.innerHTML = html;
  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPageClick(parseInt(btn.dataset.page)));
  });
}
