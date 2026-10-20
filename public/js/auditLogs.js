/**
 * auditLogs.js — Admin audit log viewer
 */
const AuditLogs = (() => {
  let currentPage = 1;

  async function load(page = 1) {
    currentPage = page;
    const action   = document.getElementById('logActionFilter')?.value || '';
    const resource = document.getElementById('logResourceFilter')?.value || '';

    try {
      const data = await API.get('/audit-logs', {
        params: { page, limit: 20, action, resource },
      });
      const logs = data.logs || [];
      renderTable(logs);
      renderPagination(data.pagination);
      document.getElementById('logCount').textContent =
        `Showing ${logs.length} of ${data.pagination?.total || 0} logs`;

      const empty = document.getElementById('logEmpty');
      const table = document.querySelector('#page-audit-logs .table-wrap');
      if (logs.length === 0) {
        table?.classList.add('hidden');
        empty?.classList.remove('hidden');
      } else {
        table?.classList.remove('hidden');
        empty?.classList.add('hidden');
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  function actionBadge(action) {
    const map = {
      create:        'badge-approved',
      update:        'badge-pending',
      delete:        'badge-rejected',
      login:         'badge-active',
      logout:        'badge-inactive',
      login_failed:  'badge-rejected',
      status_change: 'badge-on_leave',
      export:        'badge-full_time',
      bulk_update:   'badge-pending',
    };
    return map[action] || 'badge-inactive';
  }

  function renderTable(logs) {
    const tbody = document.getElementById('logTableBody');
    if (!tbody) return;

    tbody.innerHTML = logs.map(l => {
      const time = new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      const details = l.resourceName
        ? `${esc(l.resource)} — ${esc(l.resourceName)}`
        : esc(l.resource);
      const changesStr = l.changes ? JSON.stringify(l.changes).slice(0, 80) : '';

      return `
      <tr>
        <td style="white-space:nowrap;font-size:12.5px;color:var(--clr-text-muted)">${time}</td>
        <td>${esc(l.actorName || '—')}</td>
        <td><span class="badge badge-${l.actorRole === 'admin' ? 'approved' : l.actorRole === 'hr_manager' ? 'pending' : 'inactive'}">${esc(l.actorRole)}</span></td>
        <td><span class="badge ${actionBadge(l.action)}">${esc(l.action)}</span></td>
        <td>${details}</td>
        <td style="max-width:200px;font-size:12px;color:var(--clr-text-muted)" class="truncate" title="${esc(changesStr)}">${esc(changesStr)}</td>
      </tr>`;
    }).join('');
  }

  function renderPagination(pg) {
    const el = document.getElementById('logPagination');
    if (!el || !pg) return;
    const { page, pages } = pg;
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="pag-btn" ${page <= 1 ? 'disabled' : ''} onclick="AuditLogs.load(${page - 1})">‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button class="pag-btn ${i === page ? 'active' : ''}" onclick="AuditLogs.load(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn" ${page >= pages ? 'disabled' : ''} onclick="AuditLogs.load(${page + 1})">›</button>`;
    el.innerHTML = html;
  }

  function setupListeners() {
    document.getElementById('logActionFilter')?.addEventListener('change', () => load(1));
    document.getElementById('logResourceFilter')?.addEventListener('change', () => load(1));
  }

  return { load, setupListeners };
})();
