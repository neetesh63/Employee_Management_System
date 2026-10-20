/**
 * app.js — Main application orchestrator
 * Handles routing, theme, toasts, confirm dialog, and boot sequence.
 */

/* ── Global Helpers ───────────────────────────────────────── */
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''; }
function formatStatus(s) {
  const m = { active: 'Active', inactive: 'Inactive', on_leave: 'On Leave' };
  return m[s] || capitalize(s);
}
function formatType(t) {
  const m = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern' };
  return m[t] || capitalize(t);
}
function formatLeaveType(t) {
  const m = { annual: 'Annual', sick: 'Sick', casual: 'Casual', unpaid: 'Unpaid', maternity: 'Maternity', paternity: 'Paternity' };
  return m[t] || capitalize(t);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Toast Notification System ────────────────────────────── */
const Toast = (() => {
  function show(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = { success: 'check-circle', error: 'alert-circle', warn: 'alert-triangle', info: 'info' };
    toast.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i><span>${esc(message)}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
  return { show };
})();

/* ── App Object ───────────────────────────────────────────── */
const app = (() => {
  let currentPage = 'dashboard';
  const PAGES = ['dashboard', 'employees', 'employee-profile', 'departments', 'leaves', 'audit-logs', 'settings'];

  // ── Navigation ──────────────────────────────────────────
  function navigate(page, opts = {}) {
    if (!PAGES.includes(page)) page = 'dashboard';

    // Role restrictions
    if (page === 'audit-logs' && !Auth.isAdmin()) {
      page = 'dashboard';
    }

    // Employee can only see leaves and settings
    if (Auth.isEmployee() && !['leaves', 'settings', 'employee-profile'].includes(page)) {
      page = 'leaves';
    }

    currentPage = page;

    // Show/hide pages
    PAGES.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.classList.toggle('hidden', p !== page);
    });

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumbPage');
    const titles = {
      dashboard: 'Dashboard', employees: 'Employees', 'employee-profile': 'Employee Profile',
      departments: 'Departments', leaves: 'Leave Requests', 'audit-logs': 'Audit Logs', settings: 'Settings',
    };
    if (breadcrumb) breadcrumb.textContent = titles[page] || page;

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');

    // Load page data
    switch (page) {
      case 'dashboard':   Dashboard.load(); break;
      case 'employees':   Employees.loadDepartments().then(() => { Employees.populateDeptDropdowns(); Employees.load(); }); break;
      case 'departments': Departments.load(); break;
      case 'leaves':      Leaves.load(); break;
      case 'audit-logs':  AuditLogs.load(); break;
      case 'employee-profile':
        if (opts.id) Employees.viewProfile(opts.id);
        break;
    }

    // Update URL hash
    if (page !== 'employee-profile') {
      window.history.replaceState(null, '', `#${page}`);
    }
  }

  function viewEmployee(id) {
    navigate('employee-profile', { id });
  }

  // ── Confirm Dialog ──────────────────────────────────────
  let confirmCallback = null;

  function confirm({ title, message, okText = 'Delete', onOk }) {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOk').textContent      = okText;
    confirmCallback = onOk;
    document.getElementById('confirmModal').showModal();
  }

  // ── Theme ──────────────────────────────────────────────
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pd_theme', theme);

    // Update settings page buttons
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeOpt === theme);
    });

    // Refresh charts with new theme colors
    Dashboard.refreshCharts();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'light' ? 'dark' : 'light');
  }

  // ── Boot ──────────────────────────────────────────────
  async function boot() {
    // Init Lucide icons
    lucide.createIcons();

    // Check session
    const loggedIn = await Auth.checkSession();

    if (loggedIn) {
      showApp();
    } else {
      showLogin();
    }

    setupGlobalListeners();
  }

  function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    lucide.createIcons();
  }

  function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    Auth.updateUserUI();

    // Determine initial page from hash or default
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(hash);

    Attendance.checkToday();

    lucide.createIcons();
  }

  // ── Global Event Listeners ────────────────────────────
  function setupGlobalListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errorEl = document.getElementById('loginError');
      const btn = document.getElementById('loginBtn');
      const btnText = btn.querySelector('.btn-text');
      const loader = btn.querySelector('.btn-loader');

      errorEl.textContent = '';
      btn.disabled = true;
      btnText.textContent = 'Signing in…';
      loader.classList.remove('hidden');

      try {
        await Auth.login(email, password);
        showApp();
        Toast.show(`Welcome back, ${Auth.getUser()?.name || 'User'}!`, 'success');
      } catch (err) {
        errorEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btnText.textContent = 'Sign in';
        loader.classList.add('hidden');
      }
    });

    // Password toggle
    document.getElementById('togglePw')?.addEventListener('click', () => {
      const inp = document.getElementById('loginPassword');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await Auth.logout();
      showLogin();
      Toast.show('Logged out successfully.', 'success');
    });

    // Sidebar nav
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.page);
      });
    });

    // Sidebar collapse
    document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');

      // Adjust topbar left position
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.left = sidebar.classList.contains('collapsed') ? 'var(--sidebar-w-col)' : 'var(--sidebar-w)';
      }
    });

    // Mobile sidebar
    document.getElementById('mobileSidebarBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.add('mobile-open');
      document.getElementById('sidebarOverlay')?.classList.add('visible');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.getElementById('sidebarOverlay')?.classList.remove('visible');
    });

    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('themeLight')?.addEventListener('click', () => setTheme('light'));
    document.getElementById('themeDark')?.addEventListener('click', () => setTheme('dark'));

    // Init settings theme buttons active state
    const currentTheme = localStorage.getItem('pd_theme') || 'light';
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeOpt === currentTheme);
    });

    // Confirm dialog
    document.getElementById('confirmOk')?.addEventListener('click', () => {
      document.getElementById('confirmModal').close();
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
    });
    document.getElementById('confirmCancel')?.addEventListener('click', () => {
      document.getElementById('confirmModal').close();
      confirmCallback = null;
    });

    // Change password form
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msgEl = document.getElementById('pwChangeMsg');
      try {
        await Auth.changePassword(fd.get('currentPassword'), fd.get('newPassword'));
        msgEl.style.color = 'var(--clr-success)';
        msgEl.textContent = 'Password changed successfully!';
        e.target.reset();
      } catch (err) {
        msgEl.style.color = 'var(--clr-danger)';
        msgEl.textContent = err.message;
      }
    });

    // Module-specific listeners
    Employees.setupListeners();
    Departments.setupListeners();
    Leaves.setupListeners();
    AuditLogs.setupListeners();
    Attendance.setupListeners();

    // Hash navigation
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      navigate(hash);
    });
  }

  return { navigate, viewEmployee, confirm, setTheme, toggleTheme, boot };
})();

/* ── Boot on DOM ready ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => app.boot());
