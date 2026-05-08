/**
 * PrimeTrade Frontend App
 * Vanilla JS SPA controller
 */
console.log("APP JS RUNNING");
const API = window.API;

// ─── Utility ──────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $(`${id}-view`).classList.add('active');
  document.querySelector(`[data-view="${id}"]`)?.classList.add('active');
}

function toast(message, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: '◈' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.opacity = loading ? '0' : '1';
  if (loader) loader.classList.toggle('hidden', !loading);
}

function showMsg(id, msg, type = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.className = `form-message ${type}`;
}

function hideMsg(id) { $(id).className = 'form-message hidden'; }

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Password Strength ────────────────────────────────────────────────────────
function checkPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;

  const fill = $('pw-strength-fill');
  const hint = $('pw-hint');
  if (!fill) return;

  const levels = [
    { pct: '0%', color: 'transparent', label: '' },
    { pct: '20%', color: '#ff4757', label: 'Very weak' },
    { pct: '40%', color: '#ffa502', label: 'Weak' },
    { pct: '60%', color: '#eccc68', label: 'Fair' },
    { pct: '80%', color: '#7bed9f', label: 'Good' },
    { pct: '100%', color: '#2ed573', label: 'Strong ✓' },
  ];

  const level = levels[score];
  fill.style.width = level.pct;
  fill.style.background = level.color;
  if (hint) hint.textContent = level.label;
}

// ─── Auth Tab Switcher ────────────────────────────────────────────────────────
let activeTab = 'login';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    $(`${activeTab}-form`).classList.add('active');

    const indicator = document.querySelector('.tab-indicator');
    indicator.classList.toggle('right', activeTab === 'register');
  });
});

// ─── Toggle Password Visibility ───────────────────────────────────────────────
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    if (input.type === 'password') {
      input.type = 'text'; btn.textContent = '◎';
    } else {
      input.type = 'password'; btn.textContent = '◉';
    }
  });
});

// ─── Password Strength Live Check ─────────────────────────────────────────────
$('reg-password').addEventListener('input', e => checkPasswordStrength(e.target.value));

// ─── Login ────────────────────────────────────────────────────────────────────
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMsg('login-error');
  const btn = $('login-btn');
  setLoading(btn, true);

  try {
    await API.Auth.login(
      $('login-email').value.trim(),
      $('login-password').value
    );
    await initDashboard();
    showScreen('dashboard-screen');
    toast('Welcome back!', 'success');
  } catch (err) {
    showMsg('login-error', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ─── Register ─────────────────────────────────────────────────────────────────
$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMsg('register-error');
  hideMsg('register-success');
  const btn = $('register-btn');
  setLoading(btn, true);

  const payload = {
    email: $('reg-email').value.trim(),
    username: $('reg-username').value.trim(),
    password: $('reg-password').value,
    full_name: $('reg-fullname').value.trim() || null,
  };

  try {
    await API.Auth.register(payload);
    showMsg('register-success', '🎉 Account created! You can now sign in.', 'success');
    $('register-form').reset();
    $('pw-strength-fill').style.width = '0';
    $('pw-hint').textContent = '';
  } catch (err) {
    showMsg('register-error', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ─── Dashboard Init ───────────────────────────────────────────────────────────
let currentUser = null;

async function initDashboard() {
  currentUser = await Auth.me();

  $('sidebar-username').textContent = currentUser.username;
  $('sidebar-role').textContent = currentUser.role;
  $('user-avatar-text').textContent = currentUser.username[0].toUpperCase();

  // Show admin nav if admin
  if (currentUser.role === 'admin') {
    $('admin-nav-item').style.display = 'flex';
  }

  await loadTasks();
}

// ─── Logout ───────────────────────────────────────────────────────────────────
$('logout-btn').addEventListener('click', async () => {
  await Auth.logout();
  currentUser = null;
  currentPage = 1;
  showScreen('auth-screen');
  toast('Signed out successfully', 'info');
});

// ─── Navigation ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    showView(view);
    if (view === 'admin') loadUsers();
    if (view === 'tasks') loadTasks();
  });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
let currentPage = 1;
const PAGE_SIZE = 9;

function getFilters() {
  return {
    status: $('filter-status').value,
    priority: $('filter-priority').value,
  };
}

async function loadTasks() {
  const grid = $('tasks-grid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Fetching tasks...</p></div>';

  try {
    const filters = getFilters();
    const data = await API.Tasks.list({
      page: currentPage, page_size: PAGE_SIZE,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
    });

    $('task-count-label').textContent = `${data.total} task${data.total !== 1 ? 's' : ''} total`;
    renderTasks(data.tasks);
    renderPagination(data.page, data.total_pages);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠</span><p>${err.message}</p></div>`;
  }
}

function renderTasks(tasks) {
  const grid = $('tasks-grid');
  if (!tasks.length) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">◫</span><p>No tasks yet. Create your first one!</p></div>';
    return;
  }

  grid.innerHTML = tasks.map((t, i) => `
    <div class="task-card" data-priority="${t.priority}" style="animation-delay:${i * 40}ms">
      <div class="task-card-header">
        <h3 class="task-title">${escHtml(t.title)}</h3>
        <div class="task-actions">
          <button class="action-btn edit" onclick="openEditTask('${t.id}')" title="Edit">✎</button>
          <button class="action-btn delete" onclick="deleteTask('${t.id}')" title="Delete">⊗</button>
        </div>
      </div>
      ${t.description ? `<p class="task-description">${escHtml(t.description)}</p>` : ''}
      <div class="task-meta">
        <span class="badge status-${t.status}">${t.status.replace('_', ' ')}</span>
        <span class="badge priority-${t.priority}">${t.priority}</span>
        ${t.due_date ? `<span class="task-due">📅 ${formatDate(t.due_date)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderPagination(page, totalPages) {
  const pag = $('pagination');
  if (totalPages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  $('pg-info').textContent = `Page ${page} / ${totalPages}`;
  $('pg-prev').disabled = page <= 1;
  $('pg-next').disabled = page >= totalPages;
}

$('pg-prev').addEventListener('click', () => { currentPage--; loadTasks(); });
$('pg-next').addEventListener('click', () => { currentPage++; loadTasks(); });

$('filter-status').addEventListener('change', () => { currentPage = 1; loadTasks(); });
$('filter-priority').addEventListener('change', () => { currentPage = 1; loadTasks(); });

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
let editingTaskId = null;

function openCreateTask() {
  editingTaskId = null;
  $('modal-title').textContent = 'New Task';
  $('task-form').reset();
  $('task-id').value = '';
  hideMsg('task-form-error');
  $('task-modal').classList.remove('hidden');
}

async function openEditTask(id) {
  editingTaskId = id;
  $('modal-title').textContent = 'Edit Task';
  hideMsg('task-form-error');

  try {
    const task = await Tasks.get(id);
    $('task-id').value = task.id;
    $('task-title').value = task.title;
    $('task-description').value = task.description || '';
    $('task-status').value = task.status;
    $('task-priority').value = task.priority;
    if (task.due_date) {
      $('task-due').value = task.due_date.slice(0, 16);
    } else {
      $('task-due').value = '';
    }
    $('task-modal').classList.remove('hidden');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function closeModal() {
  $('task-modal').classList.add('hidden');
  editingTaskId = null;
}

$('open-create-task').addEventListener('click', openCreateTask);
$('close-modal').addEventListener('click', closeModal);
$('cancel-modal').addEventListener('click', closeModal);
$('task-modal').addEventListener('click', e => { if (e.target === $('task-modal')) closeModal(); });

window.openEditTask = openEditTask;

// ─── Save Task (Create/Update) ─────────────────────────────────────────────────
$('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMsg('task-form-error');
  const btn = $('save-task-btn');
  setLoading(btn, true);

  const payload = {
    title: $('task-title').value.trim(),
    description: $('task-description').value.trim() || null,
    status: $('task-status').value,
    priority: $('task-priority').value,
    due_date: $('task-due').value ? new Date($('task-due').value).toISOString() : null,
  };

  try {
    if (editingTaskId) {
      await Tasks.update(editingTaskId, payload);
      toast('Task updated!', 'success');
    } else {
      await Tasks.create(payload);
      toast('Task created!', 'success');
    }
    closeModal();
    await loadTasks();
  } catch (err) {
    showMsg('task-form-error', err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ─── Delete Task ──────────────────────────────────────────────────────────────
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await Tasks.delete(id);
    toast('Task deleted', 'info');
    await loadTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.deleteTask = deleteTask;

// ─── Admin: Users ─────────────────────────────────────────────────────────────
async function loadUsers() {
  const wrap = $('users-table-wrap');
  wrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>';

  try {
    const users = await API.Admin.listUsers();
    wrap.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>Username</th><th>Email</th><th>Role</th>
            <th>Status</th><th>Last Login</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escHtml(u.username)}</td>
              <td>${escHtml(u.email)}</td>
              <td><span class="badge priority-${u.role === 'admin' ? 'critical' : 'medium'}">${u.role}</span></td>
              <td><span class="badge ${u.is_active ? 'status-done' : 'status-in_progress'}">${u.is_active ? 'active' : 'inactive'}</span></td>
              <td>${u.last_login ? formatDate(u.last_login) : '—'}</td>
              <td>
                ${u.id !== currentUser?.id ? `
                  <button class="action-btn delete" onclick="adminDeactivate('${u.id}')" title="Deactivate">⊗</button>
                ` : '<span style="color:var(--text-3);font-size:0.75rem">You</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠</span><p>${err.message}</p></div>`;
  }
}

$('refresh-users-btn').addEventListener('click', loadUsers);

async function adminDeactivate(id) {
  if (!confirm('Deactivate this user?')) return;
  try {
    await Admin.deactivateUser(id);
    toast('User deactivated', 'info');
    loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.adminDeactivate = adminDeactivate;

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  if (API.TokenStore.access) {
    try {
      await initDashboard();
      showScreen('dashboard-screen');
    } catch {
      TokenStore.clear();
      showScreen('auth-screen');
    }
  } else {
    showScreen('auth-screen');
  }
})();
