const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const { logAction } = require('../utils/auditLogger');
const { generateCSV } = require('../utils/csvExport');

// ─── Helper: resolve department by ID or name ────────────────
async function resolveDepartment(deptInput) {
  if (!deptInput) return null;
  if (mongoose.isValidObjectId(deptInput)) {
    const doc = await Department.findById(deptInput);
    if (doc) return doc;
  }
  return await Department.findOne({ name: new RegExp(`^${String(deptInput).trim()}$`, 'i') });
}

// ─── Helper: auto-generate next EMP ID ────────────────────────
async function nextEmployeeId() {
  const last = await Employee.findOne({}, { employeeId: 1 }).sort({ employeeId: -1 }).lean();
  if (!last) return 'EMP001';
  const num = parseInt(last.employeeId.replace('EMP', ''), 10) + 1;
  return `EMP${String(num).padStart(3, '0')}`;
}

// ─── Allowed sort fields whitelist ────────────────────────────
const SORT_WHITELIST = ['name', 'joiningDate', 'salary', 'createdAt', 'employeeId', 'designation', 'performanceRating'];

// ─── GET /api/employees ───────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const {
      page = 1, limit = 10,
      q = '', department, status, employmentType,
      sort = 'createdAt', order = 'desc',
    } = req.query;

    const pg   = Math.max(1, parseInt(page) || 1);
    const lim  = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pg - 1) * lim;

    const filter = {};
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name:        { $regex: safe, $options: 'i' } },
        { email:       { $regex: safe, $options: 'i' } },
        { employeeId:  { $regex: safe, $options: 'i' } },
        { designation: { $regex: safe, $options: 'i' } },
      ];
    }
    if (department)     filter.department     = department;
    if (status)         filter.status         = status;
    if (employmentType) filter.employmentType = employmentType;

    const sortField = SORT_WHITELIST.includes(sort) ? sort : 'createdAt';
    const sortDir   = order === 'asc' ? 1 : -1;

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('department', 'name')
        .populate('reportingManager', 'name employeeId')
        .sort({ [sortField]: sortDir })
        .skip(skip).limit(lim).lean(),
      Employee.countDocuments(filter),
    ]);

    res.json({
      employees,
      pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
};

// ─── GET /api/employees/:id ───────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id)
      .populate('department', 'name description')
      .populate('reportingManager', 'name employeeId designation');

    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    // employee role: can only view their own profile
    if (req.user.role === 'employee') {
      if (!req.user.employeeRef || req.user.employeeRef.toString() !== emp._id.toString()) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
    res.json({ employee: emp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee.' });
  }
};

// ─── POST /api/employees ──────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      name, email, phone, profilePhoto,
      department, designation, joiningDate,
      status, employmentType, salary,
      reportingManager, skills, address,
      performanceRating, bloodGroup, emergencyContact,
    } = req.body;

    if (!name || !email || !department || !designation || !joiningDate || salary === undefined) {
      return res.status(400).json({
        error: 'Name, email, department, designation, joining date, and salary are required.',
      });
    }

    const deptDoc = await resolveDepartment(department);
    if (!deptDoc) {
      return res.status(400).json({ error: 'Selected department does not exist.' });
    }

    const emailLc = String(email).toLowerCase().trim();
    if (await Employee.findOne({ email: emailLc })) {
      return res.status(409).json({ error: 'An employee with this email already exists.' });
    }

    const employeeId = await nextEmployeeId();

    const emp = await Employee.create({
      employeeId,
      name: String(name).trim(),
      email: emailLc,
      phone: phone ? String(phone).trim() : undefined,
      profilePhoto: profilePhoto ? String(profilePhoto).trim() : '',
      department: deptDoc._id,
      designation: String(designation).trim(),
      joiningDate: new Date(joiningDate),
      status: status || 'active',
      employmentType: employmentType || 'full_time',
      salary: Number(salary),
      reportingManager: reportingManager || undefined,
      skills: Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean) : [],
      address: address ? String(address).trim() : undefined,
      performanceRating: performanceRating ? Math.min(5, Math.max(1, Number(performanceRating))) : 4,
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : '',
      emergencyContact: emergencyContact || {},
    });

    await emp.populate('department', 'name');

    await logAction({
      actor: req.user, action: 'create',
      resource: 'employee', resourceId: emp._id, resourceName: emp.name, req,
    });

    res.status(201).json({ employee: emp, message: 'Employee added successfully.' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate employee ID or email.' });
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
};

// ─── PUT /api/employees/:id ───────────────────────────────────
exports.update = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const {
      name, email, phone, profilePhoto,
      department, designation, joiningDate,
      status, employmentType, salary,
      reportingManager, skills, address,
      performanceRating, bloodGroup, emergencyContact,
    } = req.body;

    if (email) {
      const emailLc = String(email).toLowerCase().trim();
      if (emailLc !== emp.email) {
        const dup = await Employee.findOne({ email: emailLc, _id: { $ne: emp._id } });
        if (dup) return res.status(409).json({ error: 'Another employee already uses this email.' });
        emp.email = emailLc;
      }
    }
    if (department) {
      const deptDoc = await resolveDepartment(department);
      if (!deptDoc) {
        return res.status(400).json({ error: 'Selected department does not exist.' });
      }
      emp.department = deptDoc._id;
    }

    const before = { name: emp.name, status: emp.status, salary: emp.salary };

    if (name)                            emp.name               = String(name).trim();
    if (phone !== undefined)             emp.phone              = phone ? String(phone).trim() : undefined;
    if (profilePhoto !== undefined)       emp.profilePhoto       = String(profilePhoto || '').trim();
    if (designation)                     emp.designation        = String(designation).trim();
    if (joiningDate)                     emp.joiningDate        = new Date(joiningDate);
    if (status)                          emp.status             = status;
    if (employmentType)                  emp.employmentType     = employmentType;
    if (salary !== undefined)            emp.salary             = Number(salary);
    if (reportingManager !== undefined)  emp.reportingManager   = reportingManager || undefined;
    if (skills !== undefined)            emp.skills             = Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean) : [];
    if (address !== undefined)           emp.address            = address ? String(address).trim() : undefined;
    if (performanceRating !== undefined) emp.performanceRating  = Math.min(5, Math.max(1, Number(performanceRating)));
    if (bloodGroup !== undefined)        emp.bloodGroup         = String(bloodGroup).trim();
    if (emergencyContact !== undefined)  emp.emergencyContact   = emergencyContact;

    await emp.save();
    await emp.populate('department', 'name');
    await emp.populate('reportingManager', 'name employeeId');

    await logAction({
      actor: req.user, action: 'update',
      resource: 'employee', resourceId: emp._id, resourceName: emp.name,
      changes: { before, after: { name: emp.name, status: emp.status, salary: emp.salary } },
      req,
    });

    res.json({ employee: emp, message: 'Employee updated successfully.' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
};

// ─── DELETE /api/employees/:id ────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    await logAction({
      actor: req.user, action: 'delete',
      resource: 'employee', resourceId: emp._id, resourceName: emp.name, req,
    });
    await Employee.findByIdAndDelete(req.params.id);

    res.json({ message: 'Employee deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
};

// ─── PATCH /api/employees/:id/status ─────────────────────────
exports.updateStatus = async (req, res) => {
  const VALID = ['active', 'inactive', 'on_leave'];
  const { status } = req.body;
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status value.' });

  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('department', 'name');
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    await logAction({
      actor: req.user, action: 'status_change',
      resource: 'employee', resourceId: emp._id, resourceName: emp.name, changes: { status }, req,
    });

    res.json({ employee: emp, message: `Status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

// ─── PATCH /api/employees/bulk/status ────────────────────────
exports.bulkUpdateStatus = async (req, res) => {
  const VALID = ['active', 'inactive', 'on_leave'];
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Provide at least one employee ID.' });
  if (ids.length > 50)
    return res.status(400).json({ error: 'Cannot update more than 50 employees at once.' });
  if (!VALID.includes(status))
    return res.status(400).json({ error: 'Invalid status value.' });

  try {
    const result = await Employee.updateMany({ _id: { $in: ids } }, { status });

    await logAction({
      actor: req.user, action: 'bulk_update',
      resource: 'employee', resourceName: `${result.modifiedCount} employees`,
      changes: { status, count: result.modifiedCount }, req,
    });

    res.json({ message: `${result.modifiedCount} employees updated.`, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: 'Bulk update failed.' });
  }
};

// ─── GET /api/employees/export ────────────────────────────────
exports.exportCSV = async (req, res) => {
  try {
    const { department, status, employmentType } = req.query;
    const filter = {};
    if (department)     filter.department     = department;
    if (status)         filter.status         = status;
    if (employmentType) filter.employmentType = employmentType;

    const employees = await Employee.find(filter)
      .populate('department', 'name')
      .populate('reportingManager', 'name')
      .sort({ employeeId: 1 }).lean();

    await logAction({
      actor: req.user, action: 'export',
      resource: 'employee', resourceName: `${employees.length} records`, req,
    });

    const csv = generateCSV(employees);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed.' });
  }
};

// ─── GET /api/employees/:id/salary-slip ─────────────────────────
exports.getSalarySlip = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id)
      .populate('department', 'name')
      .populate('reportingManager', 'name');
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    // Restrict employee role to own record
    if (req.user.role === 'employee' && req.user.employeeRef?.toString() !== emp._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const grossMonthly = Number(emp.salary || 0);
    const basic = Math.round(grossMonthly * 0.50);
    const hra = Math.round(grossMonthly * 0.30);
    const special = grossMonthly - (basic + hra);

    const pf = Math.round(basic * 0.12);
    const pt = grossMonthly > 15000 ? 200 : 0;
    const tds = grossMonthly > 50000 ? Math.round(grossMonthly * 0.05) : 0;
    const totalDeductions = pf + pt + tds;
    const netSalary = grossMonthly - totalDeductions;

    const today = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const slipMonth = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    res.json({
      slip: {
        employee: {
          id: emp._id,
          employeeId: emp.employeeId,
          name: emp.name,
          email: emp.email,
          designation: emp.designation,
          department: emp.department?.name || 'General',
          joiningDate: emp.joiningDate,
          bloodGroup: emp.bloodGroup || 'N/A',
          performanceRating: emp.performanceRating || 4,
        },
        period: slipMonth,
        payDate: today.toISOString().split('T')[0],
        earnings: [
          { name: 'Basic Salary', amount: basic },
          { name: 'House Rent Allowance (HRA)', amount: hra },
          { name: 'Special Allowance', amount: special },
        ],
        grossEarnings: grossMonthly,
        deductions: [
          { name: 'Provident Fund (PF)', amount: pf },
          { name: 'Professional Tax (PT)', amount: pt },
          { name: 'Tax Deducted at Source (TDS)', amount: tds },
        ],
        totalDeductions,
        netSalary,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate salary slip.' });
  }
};
