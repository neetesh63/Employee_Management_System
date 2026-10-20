/**
 * auth.js — Login / Logout / Session management
 */
const Auth = (() => {
  let currentUser = null;

  function getUser() { return currentUser; }
  function isAdmin() { return currentUser?.role === 'admin'; }
  function isHR()    { return currentUser?.role === 'hr_manager'; }
  function isEmployee() { return currentUser?.role === 'employee'; }
  function canManage()  { return isAdmin() || isHR(); }

  function initials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function roleLabel(role) {
    const map = { admin: 'Administrator', hr_manager: 'HR Manager', employee: 'Employee' };
    return map[role] || role;
  }

  // Check existing session on page load
  async function checkSession() {
    try {
      const data = await API.get('/auth/me');
      currentUser = data.user;
      return true;
    } catch {
      currentUser = null;
      return false;
    }
  }

  async function login(email, password) {
    const data = await API.post('/auth/login', { email, password });
    currentUser = data.user;
    return data;
  }

  async function logout() {
    try { await API.post('/auth/logout'); } catch { /* ignore */ }
    currentUser = null;
  }

  async function changePassword(currentPassword, newPassword) {
    return API.put('/auth/password', { currentPassword, newPassword });
  }

  // Update all user-display elements
  function updateUserUI() {
    if (!currentUser) return;
    const ini = initials(currentUser.name);
    const role = roleLabel(currentUser.role);

    const els = {
      sidebarAvatar:   ini,
      topbarAvatar:    ini,
      sidebarUserName: currentUser.name,
      sidebarUserRole: role,
      topbarUserName:  currentUser.name,
      topbarUserRole:  role,
    };
    Object.entries(els).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    // Show/hide admin-only nav items
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin() ? '' : 'none';
    });

    // Employee role: hide certain actions
    if (isEmployee()) {
      document.querySelectorAll('.page-actions').forEach(el => {
        el.style.display = 'none';
      });
    }
  }

  return { getUser, isAdmin, isHR, isEmployee, canManage, initials, roleLabel, checkSession, login, logout, changePassword, updateUserUI };
})();
