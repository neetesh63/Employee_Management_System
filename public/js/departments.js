/**
 * departments.js — Department CRUD and grid view
 */
const Departments = (() => {

  let deptList = [];

  async function load() {
    try {
      const data = await API.get('/departments');
      deptList = data.departments || [];
      render(deptList);
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  function render(departments) {
    const grid = document.getElementById('deptGrid');
    const empty = document.getElementById('deptEmpty');
    if (!grid) return;

    if (departments.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    grid.innerHTML = departments.map(d => `
      <div class="dept-card" data-id="${d._id}">
        <div class="dept-card-header">
          <div class="dept-icon"><i data-lucide="building-2"></i></div>
          ${Auth.canManage() ? `
          <div class="dept-actions">
            <button class="icon-btn edit" title="Edit" onclick="Departments.openEdit('${d._id}')"><i data-lucide="pencil"></i></button>
            ${Auth.isAdmin() ? `
            <button class="icon-btn del" title="Delete" onclick="Departments.confirmDelete('${d._id}','${esc(d.name)}',${d.employeeCount || 0})"><i data-lucide="trash-2"></i></button>` : ''}
          </div>` : ''}
        </div>
        <div class="dept-name">${esc(d.name)}</div>
        <div class="dept-desc">${esc(d.description || 'No description.')}</div>
        <div class="dept-stats">
          <div class="dept-stat">
            <span class="dept-stat-val">${d.employeeCount || 0}</span>
            <span class="dept-stat-lbl">Total</span>
          </div>
          <div class="dept-stat">
            <span class="dept-stat-val">${d.activeCount || 0}</span>
            <span class="dept-stat-lbl">Active</span>
          </div>
        </div>
        ${d.headEmployee ? `
        <div class="dept-head"><i data-lucide="user"></i> ${esc(d.headEmployee.name)}</div>` : ''}
      </div>
    `).join('');

    lucide.createIcons();
  }

  function openCreate() {
    document.getElementById('deptModalTitle').textContent = 'Add Department';
    document.getElementById('deptSaveBtn').textContent    = 'Save Department';
    document.getElementById('departmentForm').reset();
    document.querySelector('#departmentForm input[name="id"]').value = '';
    document.getElementById('deptFormError').textContent = '';
    populateHeadDropdown();
    document.getElementById('departmentModal').showModal();
  }

  async function openEdit(id) {
    const d = deptList.find(x => x._id === id);
    if (!d) return;

    document.getElementById('deptModalTitle').textContent = 'Edit Department';
    document.getElementById('deptSaveBtn').textContent    = 'Update Department';
    document.getElementById('deptFormError').textContent = '';

    const form = document.getElementById('departmentForm');
    form.reset();
    populateHeadDropdown();

    form.querySelector('[name="id"]').value          = d._id;
    form.querySelector('[name="name"]').value         = d.name || '';
    form.querySelector('[name="description"]').value  = d.description || '';

    // Need to wait a tick for dropdown to populate
    setTimeout(() => {
      form.querySelector('[name="headEmployee"]').value = d.headEmployee?._id || '';
    }, 50);

    document.getElementById('departmentModal').showModal();
  }

  async function populateHeadDropdown() {
    // Fetch employees for head selection
    try {
      const data = await API.get('/employees', { params: { limit: 100 } });
      const el = document.querySelector('#departmentForm select[name="headEmployee"]');
      if (el) {
        el.innerHTML = '<option value="">None</option>' +
          (data.employees || []).map(e => `<option value="${e._id}">${esc(e.name)} (${esc(e.employeeId)})</option>`).join('');
      }
    } catch { /* ignore */ }
  }

  async function save(formData) {
    const id = formData.get('id');
    const body = {
      name: formData.get('name'),
      description: formData.get('description'),
      headEmployee: formData.get('headEmployee') || null,
    };

    try {
      if (id) {
        await API.put(`/departments/${id}`, body);
        Toast.show('Department updated successfully.', 'success');
      } else {
        await API.post('/departments', body);
        Toast.show('Department created successfully.', 'success');
      }
      document.getElementById('departmentModal').close();
      load();
      Employees.loadDepartments().then(() => Employees.populateDeptDropdowns());
      Dashboard.load();
    } catch (err) {
      document.getElementById('deptFormError').textContent = err.message;
    }
  }

  function confirmDelete(id, name, empCount) {
    if (empCount > 0) {
      Toast.show(`Cannot delete "${name}" — ${empCount} employee(s) are assigned. Reassign them first.`, 'error');
      return;
    }
    app.confirm({
      title: 'Delete Department',
      message: `Are you sure you want to delete "${name}"?`,
      okText: 'Delete',
      onOk: async () => {
        try {
          await API.delete(`/departments/${id}`);
          Toast.show('Department deleted.', 'success');
          load();
          Employees.loadDepartments().then(() => Employees.populateDeptDropdowns());
          Dashboard.load();
        } catch (err) {
          Toast.show(err.message, 'error');
        }
      },
    });
  }

  function setupListeners() {
    document.getElementById('addDeptBtn')?.addEventListener('click', openCreate);
    document.getElementById('deptModalClose')?.addEventListener('click', () => document.getElementById('departmentModal').close());
    document.getElementById('deptModalCancel')?.addEventListener('click', () => document.getElementById('departmentModal').close());
    document.getElementById('departmentForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      save(new FormData(e.target));
    });
  }

  return { load, openCreate, openEdit, confirmDelete, setupListeners };
})();
