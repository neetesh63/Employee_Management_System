/**
 * leaves.js — Leave request management
 */
const Leaves = (() => {
  let currentPage = 1;

  async function load(page = 1) {
    currentPage = page;
    const status = document.getElementById('leaveStatusFilter')?.value || '';

    try {
      const data = await API.get('/leaves', {
        params: { page, limit: 10, status },
      });
      const leaves = data.leaves || [];
      renderTable(leaves);
      renderPagination(data.pagination);
      document.getElementById('leaveCount').textContent =
        `Showing ${leaves.length} of ${data.pagination?.total || 0} requests`;

      const empty = document.getElementById('leaveEmpty');
      const table = document.querySelector('#page-leaves .table-wrap');
      if (leaves.length === 0) {
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

  function renderTable(leaves) {
    const tbody = document.getElementById('leaveTableBody');
    if (!tbody) return;

    tbody.innerHTML = leaves.map(l => {
      const empName = l.employee?.name || '—';
      const empId   = l.employee?.employeeId || '';

      return `
      <tr>
        <td>
          <div class="emp-cell">
            <div class="emp-avatar" style="width:28px;height:28px;font-size:10px">${Auth.initials(empName)}</div>
            <div>
              <div class="emp-name">${esc(empName)}</div>
              <div class="emp-id">${esc(empId)}</div>
            </div>
          </div>
        </td>
        <td>${formatLeaveType(l.type)}</td>
        <td>${formatDate(l.startDate)} – ${formatDate(l.endDate)}</td>
        <td>${l.days || '—'}</td>
        <td style="max-width:180px" class="truncate" title="${esc(l.reason)}">${esc(l.reason)}</td>
        <td><span class="badge badge-${l.status}">${capitalize(l.status)}</span></td>
        <td>
          <div class="row-actions">
            ${l.status === 'pending' && Auth.canManage() ? `
            <button class="icon-btn edit" title="Approve" onclick="Leaves.review('${l._id}','approved')"><i data-lucide="check"></i></button>
            <button class="icon-btn del" title="Reject" onclick="Leaves.review('${l._id}','rejected')"><i data-lucide="x"></i></button>
            ` : ''}
            ${l.status === 'pending' ? `
            <button class="icon-btn del" title="Cancel" onclick="Leaves.cancel('${l._id}')"><i data-lucide="trash-2"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    lucide.createIcons();
  }

  function renderPagination(pg) {
    const el = document.getElementById('leavePagination');
    if (!el || !pg) return;
    const { page, pages } = pg;
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="pag-btn" ${page <= 1 ? 'disabled' : ''} onclick="Leaves.load(${page - 1})">‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button class="pag-btn ${i === page ? 'active' : ''}" onclick="Leaves.load(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn" ${page >= pages ? 'disabled' : ''} onclick="Leaves.load(${page + 1})">›</button>`;
    el.innerHTML = html;
  }

  function openCreate() {
    document.getElementById('leaveForm').reset();
    document.getElementById('leaveFormError').textContent = '';

    // Hide employee selector for employee role
    const empGroup = document.getElementById('leaveEmpGroup');
    if (Auth.isEmployee()) {
      empGroup.style.display = 'none';
    } else {
      empGroup.style.display = '';
      populateEmployeeDropdown();
    }

    document.getElementById('leaveModal').showModal();
  }

  async function populateEmployeeDropdown() {
    try {
      const data = await API.get('/employees', { params: { limit: 100, status: 'active' } });
      const el = document.getElementById('leaveEmpSelect');
      if (el) {
        el.innerHTML = '<option value="">Select employee…</option>' +
          (data.employees || []).map(e =>
            `<option value="${e._id}">${esc(e.name)} (${esc(e.employeeId)})</option>`
          ).join('');
      }
    } catch { /* ignore */ }
  }

  async function save(formData) {
    const body = {
      type:      formData.get('type'),
      startDate: formData.get('startDate'),
      endDate:   formData.get('endDate'),
      reason:    formData.get('reason'),
    };

    if (!Auth.isEmployee()) {
      body.employee = formData.get('employee');
    }

    try {
      await API.post('/leaves', body);
      Toast.show('Leave request submitted.', 'success');
      document.getElementById('leaveModal').close();
      load(1);
      Dashboard.load();
    } catch (err) {
      document.getElementById('leaveFormError').textContent = err.message;
    }
  }

  async function review(id, status) {
    const action = status === 'approved' ? 'approve' : 'reject';
    app.confirm({
      title: `${capitalize(action)} Leave`,
      message: `Are you sure you want to ${action} this leave request?`,
      okText: capitalize(action),
      onOk: async () => {
        try {
          await API.patch(`/leaves/${id}/review`, { status });
          Toast.show(`Leave ${status}.`, 'success');
          load(currentPage);
          Dashboard.load();
        } catch (err) {
          Toast.show(err.message, 'error');
        }
      },
    });
  }

  async function cancel(id) {
    app.confirm({
      title: 'Cancel Leave Request',
      message: 'Are you sure you want to cancel this leave request?',
      okText: 'Cancel Request',
      onOk: async () => {
        try {
          await API.delete(`/leaves/${id}`);
          Toast.show('Leave request cancelled.', 'success');
          load(currentPage);
          Dashboard.load();
        } catch (err) {
          Toast.show(err.message, 'error');
        }
      },
    });
  }

  function setupListeners() {
    document.getElementById('addLeaveBtn')?.addEventListener('click', openCreate);
    document.getElementById('leaveModalClose')?.addEventListener('click', () => document.getElementById('leaveModal').close());
    document.getElementById('leaveModalCancel')?.addEventListener('click', () => document.getElementById('leaveModal').close());
    document.getElementById('leaveForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      save(new FormData(e.target));
    });
    document.getElementById('leaveStatusFilter')?.addEventListener('change', () => load(1));
  }

  return { load, openCreate, review, cancel, setupListeners };
})();
