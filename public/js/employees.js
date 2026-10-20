/**
 * employees.js — Employee CRUD, table, search, filters, bulk actions, CSV export, profile view, payslip & ID card
 */
const Employees = (() => {
  let departments = [];
  let allEmployees = [];
  let selected = new Set();
  let currentPage = 1;
  let totalPages = 1;
  let debounceTimer = null;

  // ── Load departments for dropdowns ────────────────────────
  async function loadDepartments() {
    try {
      const data = await API.get('/departments');
      departments = data.departments || [];
    } catch { departments = []; }
  }

  function populateDeptDropdowns() {
    // Filter dropdown
    const filterEl = document.getElementById('filterDept');
    if (filterEl) {
      const val = filterEl.value;
      filterEl.innerHTML = '<option value="">All Departments</option>' +
        departments.map(d => `<option value="${d._id}">${esc(d.name)}</option>`).join('');
      filterEl.value = val;
    }
    // Modal dropdown
    const modalEl = document.querySelector('#employeeForm select[name="department"]');
    if (modalEl) {
      const val = modalEl.value;
      modalEl.innerHTML = '<option value="">Select department…</option>' +
        departments.map(d => `<option value="${d._id}">${esc(d.name)}</option>`).join('');
      modalEl.value = val;
    }
  }

  function populateManagerDropdown(excludeId) {
    const el = document.querySelector('#employeeForm select[name="reportingManager"]');
    if (!el) return;
    el.innerHTML = '<option value="">None</option>' +
      allEmployees
        .filter(e => e._id !== excludeId)
        .map(e => `<option value="${e._id}">${esc(e.name)} (${esc(e.employeeId)})</option>`)
        .join('');
  }

  // ── Fetch & render ────────────────────────────────────────
  async function load(page = 1) {
    currentPage = page;
    const q = document.getElementById('empSearch')?.value || '';
    const department = document.getElementById('filterDept')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    const employmentType = document.getElementById('filterType')?.value || '';
    const sort = document.getElementById('sortBy')?.value || 'createdAt';

    try {
      const data = await API.get('/employees', {
        params: { page, limit: 10, q, department, status, employmentType, sort, order: sort === 'name' ? 'asc' : 'desc' },
      });
      allEmployees = data.employees || [];
      totalPages = data.pagination?.pages || 1;
      renderTable(allEmployees);
      renderPagination(data.pagination);
      document.getElementById('empCount').textContent =
        `Showing ${allEmployees.length} of ${data.pagination?.total || 0} employees`;

      const tableEl = document.getElementById('empTable');
      const emptyEl = document.getElementById('empEmpty');
      if (allEmployees.length === 0) {
        tableEl.closest('.table-wrap').classList.add('hidden');
        emptyEl.classList.remove('hidden');
      } else {
        tableEl.closest('.table-wrap').classList.remove('hidden');
        emptyEl.classList.add('hidden');
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  function renderTable(employees) {
    const tbody = document.getElementById('empTableBody');
    if (!tbody) return;

    tbody.innerHTML = employees.map(e => {
      const avatarContent = e.profilePhoto
        ? `<img src="${esc(e.profilePhoto)}" alt="${esc(e.name)}">`
        : Auth.initials(e.name);
      const isChecked = selected.has(e._id) ? 'checked' : '';

      return `
      <tr data-id="${e._id}" class="${selected.has(e._id) ? 'selected' : ''}">
        <td><input type="checkbox" class="chk row-chk" data-id="${e._id}" ${isChecked}></td>
        <td>
          <div class="emp-cell">
            <div class="emp-avatar">${avatarContent}</div>
            <div>
              <div class="emp-name">${esc(e.name)}</div>
              <div class="emp-id">${esc(e.employeeId)}</div>
            </div>
          </div>
        </td>
        <td><span class="dept-pill">${esc(e.department?.name || '—')}</span></td>
        <td>${esc(e.designation)}</td>
        <td><span class="badge badge-${e.employmentType}">${formatType(e.employmentType)}</span></td>
        <td><span class="badge badge-${e.status}">${formatStatus(e.status)}</span></td>
        <td>₹${Number(e.salary || 0).toLocaleString('en-IN')}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn view" title="View Profile" onclick="app.viewEmployee('${e._id}')"><i data-lucide="eye"></i></button>
            <button class="icon-btn slip" title="Payslip" onclick="Employees.openPayslip('${e._id}')"><i data-lucide="receipt"></i></button>
            <button class="icon-btn idbadge" title="ID Badge" onclick="Employees.openIdCard('${e._id}')"><i data-lucide="id-card"></i></button>
            ${Auth.canManage() ? `
            <button class="icon-btn edit" title="Edit" onclick="Employees.openEdit('${e._id}')"><i data-lucide="pencil"></i></button>` : ''}
            ${Auth.isAdmin() ? `
            <button class="icon-btn del" title="Delete" onclick="Employees.confirmDelete('${e._id}','${esc(e.name)}')"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    // Re-create icons inside new rows
    lucide.createIcons();

    // Row checkboxes
    tbody.querySelectorAll('.row-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.id;
        if (chk.checked) selected.add(id); else selected.delete(id);
        chk.closest('tr').classList.toggle('selected', chk.checked);
        updateBulkBar();
      });
    });
  }

  function renderPagination(pg) {
    const el = document.getElementById('empPagination');
    if (!el || !pg) return;
    const { page, pages } = pg;
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="pag-btn" ${page <= 1 ? 'disabled' : ''} onclick="Employees.load(${page - 1})">‹</button>`;
    for (let i = 1; i <= pages; i++) {
      if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - page) > 1) {
        if (i === 3 || i === pages - 2) html += '<span style="padding:0 4px;color:var(--clr-text-light)">…</span>';
        continue;
      }
      html += `<button class="pag-btn ${i === page ? 'active' : ''}" onclick="Employees.load(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn ${page >= pages ? 'disabled' : ''} onclick="Employees.load(${page + 1})">›</button>`;
    el.innerHTML = html;
  }

  // ── Bulk actions ──────────────────────────────────────────
  function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    const countEl = document.getElementById('bulkCount');
    if (selected.size > 0) {
      bar.classList.remove('hidden');
      countEl.textContent = `${selected.size} selected`;
    } else {
      bar.classList.add('hidden');
    }
    // Update header checkbox
    const selectAll = document.getElementById('selectAllChk');
    if (selectAll) selectAll.checked = selected.size > 0 && selected.size === allEmployees.length;
  }

  async function bulkStatus(status) {
    if (selected.size === 0) return;
    try {
      await API.patch('/employees/bulk/status', { ids: [...selected], status });
      Toast.show(`${selected.size} employees updated to ${formatStatus(status)}.`, 'success');
      selected.clear();
      updateBulkBar();
      load(currentPage);
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  // ── Create / Edit modal ───────────────────────────────────
  function openCreate() {
    document.getElementById('empModalTitle').textContent = 'Add Employee';
    document.getElementById('empSaveBtn').textContent    = 'Save Employee';
    document.getElementById('employeeForm').reset();
    document.querySelector('#employeeForm input[name="id"]').value = '';
    document.getElementById('empFormError').textContent = '';
    populateDeptDropdowns();
    populateManagerDropdown(null);

    const form = document.getElementById('employeeForm');
    if (form.querySelector('[name="performanceRating"]')) form.querySelector('[name="performanceRating"]').value = '4';
    if (form.querySelector('[name="bloodGroup"]')) form.querySelector('[name="bloodGroup"]').value = '';
    if (form.querySelector('[name="emergencyContactName"]')) form.querySelector('[name="emergencyContactName"]').value = '';
    if (form.querySelector('[name="emergencyContactPhone"]')) form.querySelector('[name="emergencyContactPhone"]').value = '';

    document.getElementById('employeeModal').showModal();
  }

  async function openEdit(id) {
    try {
      const data = await API.get(`/employees/${id}`);
      const e = data.employee;

      document.getElementById('empModalTitle').textContent = 'Edit Employee';
      document.getElementById('empSaveBtn').textContent    = 'Update Employee';
      document.getElementById('empFormError').textContent = '';

      const form = document.getElementById('employeeForm');
      form.reset();
      populateDeptDropdowns();
      populateManagerDropdown(e._id);

      form.querySelector('[name="id"]').value             = e._id;
      form.querySelector('[name="name"]').value           = e.name || '';
      form.querySelector('[name="email"]').value          = e.email || '';
      form.querySelector('[name="phone"]').value          = e.phone || '';
      form.querySelector('[name="department"]').value     = e.department?._id || e.department || '';
      form.querySelector('[name="designation"]').value    = e.designation || '';
      form.querySelector('[name="joiningDate"]').value    = e.joiningDate ? e.joiningDate.split('T')[0] : '';
      form.querySelector('[name="employmentType"]').value = e.employmentType || 'full_time';
      form.querySelector('[name="status"]').value         = e.status || 'active';
      form.querySelector('[name="salary"]').value         = e.salary ?? '';
      form.querySelector('[name="reportingManager"]').value = e.reportingManager?._id || '';
      form.querySelector('[name="skills"]').value         = (e.skills || []).join(', ');
      form.querySelector('[name="address"]').value        = e.address || '';
      form.querySelector('[name="profilePhoto"]').value   = e.profilePhoto || '';

      if (form.querySelector('[name="performanceRating"]')) {
        form.querySelector('[name="performanceRating"]').value = String(e.performanceRating || 4);
      }
      if (form.querySelector('[name="bloodGroup"]')) {
        form.querySelector('[name="bloodGroup"]').value = e.bloodGroup || '';
      }
      if (form.querySelector('[name="emergencyContactName"]')) {
        form.querySelector('[name="emergencyContactName"]').value = e.emergencyContact?.name || '';
      }
      if (form.querySelector('[name="emergencyContactPhone"]')) {
        form.querySelector('[name="emergencyContactPhone"]').value = e.emergencyContact?.phone || '';
      }

      document.getElementById('employeeModal').showModal();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  async function save(formData) {
    const id = formData.get('id');
    const body = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      department: formData.get('department'),
      designation: formData.get('designation'),
      joiningDate: formData.get('joiningDate'),
      employmentType: formData.get('employmentType'),
      status: formData.get('status'),
      salary: formData.get('salary'),
      reportingManager: formData.get('reportingManager') || null,
      skills: formData.get('skills') ? formData.get('skills').split(',').map(s => s.trim()).filter(Boolean) : [],
      address: formData.get('address'),
      profilePhoto: formData.get('profilePhoto'),
      performanceRating: Number(formData.get('performanceRating')) || 4,
      bloodGroup: formData.get('bloodGroup') || '',
      emergencyContact: {
        name: formData.get('emergencyContactName') || '',
        phone: formData.get('emergencyContactPhone') || '',
      },
    };

    try {
      if (id) {
        await API.put(`/employees/${id}`, body);
        Toast.show('Employee updated successfully.', 'success');
      } else {
        await API.post('/employees', body);
        Toast.show('Employee added successfully.', 'success');
      }
      document.getElementById('employeeModal').close();
      load(id ? currentPage : 1);
      Dashboard.load(); // refresh stats
    } catch (err) {
      document.getElementById('empFormError').textContent = err.message;
    }
  }

  // ── Delete ────────────────────────────────────────────────
  function confirmDelete(id, name) {
    app.confirm({
      title: 'Delete Employee',
      message: `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      onOk: async () => {
        try {
          await API.delete(`/employees/${id}`);
          Toast.show('Employee deleted.', 'success');
          load(currentPage);
          Dashboard.load();
        } catch (err) {
          Toast.show(err.message, 'error');
        }
      },
    });
  }

  // ── CSV Export ────────────────────────────────────────────
  async function exportCSV() {
    try {
      const department = document.getElementById('filterDept')?.value || '';
      const status = document.getElementById('filterStatus')?.value || '';
      const employmentType = document.getElementById('filterType')?.value || '';

      const blob = await API.getBlob('/employees/export', {
        params: { department, status, employmentType },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('CSV exported successfully.', 'success');
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  // ── Salary Slip Generator ─────────────────────────────────
  async function openPayslip(id) {
    try {
      const data = await API.get(`/employees/${id}/salary-slip`);
      const s = data.slip;
      const emp = s.employee;

      const earningsRows = s.earnings.map(item => `
        <tr>
          <td>${esc(item.name)}</td>
          <td>₹${Number(item.amount).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      const deductionsRows = s.deductions.map(item => `
        <tr>
          <td>${esc(item.name)}</td>
          <td>₹${Number(item.amount).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      const html = `
      <div class="payslip-slip">
        <div class="slip-header">
          <div class="slip-brand">
            <div class="logo-mark sm">P</div>
            <div class="slip-brand-text">
              <h2>PeopleDesk Pro</h2>
              <p>Tech Park, Cyber Hub, Bengaluru, KA 560103</p>
            </div>
          </div>
          <div class="slip-period-badge">
            <div class="slip-period-title">Salary Slip</div>
            <div class="slip-period-val">${esc(s.period)}</div>
          </div>
        </div>

        <div class="slip-meta-grid">
          <div class="slip-meta-item"><span class="slip-meta-lbl">Employee ID</span><span class="slip-meta-val">${esc(emp.employeeId)}</span></div>
          <div class="slip-meta-item"><span class="slip-meta-lbl">Employee Name</span><span class="slip-meta-val">${esc(emp.name)}</span></div>
          <div class="slip-meta-item"><span class="slip-meta-lbl">Designation</span><span class="slip-meta-val">${esc(emp.designation)}</span></div>
          <div class="slip-meta-item"><span class="slip-meta-lbl">Department</span><span class="slip-meta-val">${esc(emp.department)}</span></div>
          <div class="slip-meta-item"><span class="slip-meta-lbl">Pay Date</span><span class="slip-meta-val">${esc(s.payDate)}</span></div>
          <div class="slip-meta-item"><span class="slip-meta-lbl">Blood Group</span><span class="slip-meta-val">${esc(emp.bloodGroup)}</span></div>
        </div>

        <div class="slip-breakdown-grid">
          <div>
            <div class="slip-table-title">EARNINGS</div>
            <table class="slip-calc-table">
              <tbody>
                ${earningsRows}
                <tr class="slip-calc-total">
                  <td>Total Gross Earnings</td>
                  <td>₹${Number(s.grossEarnings).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="slip-table-title">DEDUCTIONS</div>
            <table class="slip-calc-table">
              <tbody>
                ${deductionsRows}
                <tr class="slip-calc-total">
                  <td>Total Deductions</td>
                  <td>₹${Number(s.totalDeductions).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="slip-net-card">
          <div>
            <div class="slip-net-lbl">NET TAKE-HOME SALARY</div>
            <small style="color:var(--clr-text-muted)">Direct Bank Transfer</small>
          </div>
          <div class="slip-net-val">₹${Number(s.netSalary).toLocaleString('en-IN')}</div>
        </div>

        <div class="slip-footer">
          <span>Generated by PeopleDesk Pro HRMS · Computer Generated Document</span>
          <span>Authorized Signatory: HR Operations</span>
        </div>
      </div>`;

      document.getElementById('payslipContent').innerHTML = html;
      document.getElementById('payslipModal').showModal();
      lucide.createIcons();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  // ── Digital ID Card Generator ─────────────────────────────
  async function openIdCard(id) {
    try {
      const data = await API.get(`/employees/${id}`);
      const e = data.employee;

      const avatarContent = e.profilePhoto
        ? `<img src="${esc(e.profilePhoto)}" alt="${esc(e.name)}">`
        : Auth.initials(e.name);

      const joinYear = e.joiningDate ? new Date(e.joiningDate).getFullYear() : '2026';

      const html = `
      <div class="id-card-wrap">
        <div class="id-card">
          <div class="id-card-lanyard-slot"></div>
          <div class="id-card-banner">
            <div class="id-card-logo-text">PEOPLEDESK PRO</div>
            <small style="opacity:0.8;font-size:10px;">CORPORATE IDENTITY CARD</small>
          </div>
          <div class="id-card-avatar-wrap">
            ${avatarContent}
          </div>
          <div class="id-card-name">${esc(e.name)}</div>
          <div class="id-card-empid">${esc(e.employeeId)}</div>
          <div class="id-card-role">${esc(e.designation)} · ${esc(e.department?.name || 'General')}</div>

          <div class="id-card-chips">
            <span class="id-card-chip">Blood: ${esc(e.bloodGroup || 'O+')}</span>
            <span class="id-card-chip">Since: ${joinYear}</span>
            <span class="id-card-chip">Status: ${formatStatus(e.status)}</span>
          </div>

          <div class="id-card-qr-box">
            <div class="id-card-barcode">||| | |||| | ||||| |||</div>
            <small style="font-size:9px;color:#666;display:block;margin-top:4px;">VERIFIED EMPLOYEE</small>
          </div>

          <div class="id-card-footer-strip">
            PROPERTY OF PEOPLEDESK SYSTEMS
          </div>
        </div>
      </div>`;

      document.getElementById('idCardContent').innerHTML = html;
      document.getElementById('idCardModal').showModal();
      lucide.createIcons();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  // ── Profile view ──────────────────────────────────────────
  async function viewProfile(id) {
    try {
      const data = await API.get(`/employees/${id}`);
      const e = data.employee;

      const avatarContent = e.profilePhoto
        ? `<img src="${esc(e.profilePhoto)}" alt="${esc(e.name)}">`
        : Auth.initials(e.name);

      const ratingStars = '★'.repeat(e.performanceRating || 4) + '☆'.repeat(5 - (e.performanceRating || 4));

      const html = `
      <div class="profile-grid">
        <div class="profile-card">
          <div class="profile-avatar">${avatarContent}</div>
          <div class="profile-name">${esc(e.name)}</div>
          <div class="profile-id">${esc(e.employeeId)}</div>
          <div class="profile-designation">${esc(e.designation)}</div>
          <span class="badge badge-${e.status}" style="margin-bottom:8px">${formatStatus(e.status)}</span>
          <span class="badge badge-${e.employmentType}">${formatType(e.employmentType)}</span>

          <div class="profile-actions" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
            <button class="btn btn-outline btn-sm" onclick="Employees.openPayslip('${e._id}')"><i data-lucide="receipt"></i> Payslip</button>
            <button class="btn btn-outline btn-sm" onclick="Employees.openIdCard('${e._id}')"><i data-lucide="id-card"></i> ID Card</button>
            ${Auth.canManage() ? `
            <button class="btn btn-primary btn-sm" onclick="Employees.openEdit('${e._id}')"><i data-lucide="pencil"></i> Edit</button>
            ${Auth.isAdmin() ? `
            <button class="btn btn-danger-outline btn-sm" onclick="Employees.confirmDelete('${e._id}','${esc(e.name)}')"><i data-lucide="trash-2"></i> Delete</button>` : ''}
            ` : ''}
          </div>
        </div>

        <div class="profile-details">
          <div class="profile-section">
            <div class="profile-section-title">Contact Information</div>
            <div class="profile-field"><span class="profile-field-label">Email</span><span class="profile-field-val">${esc(e.email)}</span></div>
            <div class="profile-field"><span class="profile-field-label">Phone</span><span class="profile-field-val">${esc(e.phone || '—')}</span></div>
            <div class="profile-field"><span class="profile-field-label">Blood Group</span><span class="profile-field-val">${esc(e.bloodGroup || '—')}</span></div>
            <div class="profile-field"><span class="profile-field-label">Address</span><span class="profile-field-val">${esc(e.address || '—')}</span></div>
          </div>

          <div class="profile-section">
            <div class="profile-section-title">Employment &amp; Performance</div>
            <div class="profile-field"><span class="profile-field-label">Department</span><span class="profile-field-val">${esc(e.department?.name || '—')}</span></div>
            <div class="profile-field"><span class="profile-field-label">Designation</span><span class="profile-field-val">${esc(e.designation)}</span></div>
            <div class="profile-field"><span class="profile-field-label">Performance Rating</span><span class="profile-field-val"><span class="star-rating">${ratingStars}</span><span class="star-rating-val">${e.performanceRating || 4}/5</span></span></div>
            <div class="profile-field"><span class="profile-field-label">Employment Type</span><span class="profile-field-val">${formatType(e.employmentType)}</span></div>
            <div class="profile-field"><span class="profile-field-label">Joining Date</span><span class="profile-field-val">${formatDate(e.joiningDate)}</span></div>
            <div class="profile-field"><span class="profile-field-label">Monthly Salary</span><span class="profile-field-val">₹${Number(e.salary || 0).toLocaleString('en-IN')}</span></div>
            <div class="profile-field"><span class="profile-field-label">Reporting Manager</span><span class="profile-field-val">${esc(e.reportingManager?.name || '—')}</span></div>
          </div>

          ${e.emergencyContact?.name ? `
          <div class="profile-section">
            <div class="profile-section-title">Emergency Contact</div>
            <div class="profile-field"><span class="profile-field-label">Contact Name</span><span class="profile-field-val">${esc(e.emergencyContact.name)}</span></div>
            <div class="profile-field"><span class="profile-field-label">Contact Phone</span><span class="profile-field-val">${esc(e.emergencyContact.phone || '—')}</span></div>
          </div>` : ''}

          ${(e.skills && e.skills.length) ? `
          <div class="profile-section">
            <div class="profile-section-title">Skills &amp; Competencies</div>
            <div class="skills-tags">${e.skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div>
          </div>` : ''}
        </div>
      </div>`;

      document.getElementById('employeeProfileContent').innerHTML = html;
      lucide.createIcons();
    } catch (err) {
      Toast.show(err.message, 'error');
      app.navigate('employees');
    }
  }

  // ── Debounced search ──────────────────────────────────────
  function setupListeners() {
    const searchEl = document.getElementById('empSearch');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => load(1), 300);
      });
    }

    ['filterDept', 'filterStatus', 'filterType', 'sortBy'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => load(1));
    });

    // Select all checkbox
    const selectAll = document.getElementById('selectAllChk');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        if (selectAll.checked) {
          allEmployees.forEach(e => selected.add(e._id));
        } else {
          selected.clear();
        }
        // Re-render checkboxes
        document.querySelectorAll('.row-chk').forEach(chk => {
          chk.checked = selected.has(chk.dataset.id);
          chk.closest('tr').classList.toggle('selected', chk.checked);
        });
        updateBulkBar();
      });
    }

    // Bulk actions
    document.getElementById('bulkActive')?.addEventListener('click', () => bulkStatus('active'));
    document.getElementById('bulkInactive')?.addEventListener('click', () => bulkStatus('inactive'));
    document.getElementById('bulkOnLeave')?.addEventListener('click', () => bulkStatus('on_leave'));
    document.getElementById('clearSelection')?.addEventListener('click', () => {
      selected.clear();
      document.querySelectorAll('.row-chk').forEach(chk => {
        chk.checked = false;
        chk.closest('tr').classList.remove('selected');
      });
      updateBulkBar();
    });

    // Add employee button & export
    document.getElementById('addEmployeeBtn')?.addEventListener('click', openCreate);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

    // Modal close & save
    document.getElementById('empModalClose')?.addEventListener('click', () => document.getElementById('employeeModal').close());
    document.getElementById('empModalCancel')?.addEventListener('click', () => document.getElementById('employeeModal').close());
    document.getElementById('employeeForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      save(new FormData(e.target));
    });

    // Payslip & ID card close
    document.getElementById('payslipModalClose')?.addEventListener('click', () => document.getElementById('payslipModal').close());
    document.getElementById('idCardModalClose')?.addEventListener('click', () => document.getElementById('idCardModal').close());

    // Back from profile
    document.getElementById('backToEmployees')?.addEventListener('click', () => app.navigate('employees'));
  }

  return { load, loadDepartments, populateDeptDropdowns, openCreate, openEdit, confirmDelete, exportCSV, openPayslip, openIdCard, viewProfile, setupListeners };
})();
