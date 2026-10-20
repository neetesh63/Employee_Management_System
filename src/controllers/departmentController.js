const Department = require('../models/Department');
const Employee   = require('../models/Employee');
const { logAction } = require('../utils/auditLogger');

// GET /api/departments
exports.list = async (_req, res) => {
  try {
    const departments = await Department.find()
      .populate('headEmployee', 'name employeeId')
      .sort({ name: 1 }).lean();

    // Attach employee counts via aggregation
    const counts = await Employee.aggregate([
      { $group: {
        _id: '$department',
        total:  { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
      }},
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id?.toString()] = c; });

    const result = departments.map(d => ({
      ...d,
      employeeCount: countMap[d._id.toString()]?.total  || 0,
      activeCount:   countMap[d._id.toString()]?.active || 0,
    }));

    res.json({ departments: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
};

// GET /api/departments/:id
exports.getOne = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id)
      .populate('headEmployee', 'name employeeId designation');
    if (!dept) return res.status(404).json({ error: 'Department not found.' });

    const employees = await Employee.find({ department: req.params.id })
      .select('name employeeId designation status profilePhoto').sort({ name: 1 });

    res.json({ department: dept, employees });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department.' });
  }
};

// POST /api/departments
exports.create = async (req, res) => {
  try {
    const { name, description, headEmployee } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Department name is required.' });

    const exists = await Department.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (exists) return res.status(409).json({ error: 'A department with this name already exists.' });

    const dept = await Department.create({
      name: name.trim(),
      description: description?.trim(),
      headEmployee: headEmployee || undefined,
    });

    await logAction({ actor: req.user, action: 'create', resource: 'department', resourceId: dept._id, resourceName: dept.name, req });
    res.status(201).json({ department: dept, message: 'Department created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create department.' });
  }
};

// PUT /api/departments/:id
exports.update = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found.' });

    const { name, description, headEmployee } = req.body;

    if (name && name.trim() !== dept.name) {
      const dup = await Department.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' }, _id: { $ne: dept._id } });
      if (dup) return res.status(409).json({ error: 'A department with this name already exists.' });
      dept.name = name.trim();
    }
    if (description !== undefined) dept.description  = description?.trim();
    if (headEmployee !== undefined) dept.headEmployee = headEmployee || undefined;

    await dept.save();
    await logAction({ actor: req.user, action: 'update', resource: 'department', resourceId: dept._id, resourceName: dept.name, req });
    res.json({ department: dept, message: 'Department updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update department.' });
  }
};

// DELETE /api/departments/:id
exports.remove = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found.' });

    const count = await Employee.countDocuments({ department: req.params.id });
    if (count > 0)
      return res.status(400).json({ error: `Cannot delete: ${count} employee(s) are in this department. Reassign them first.` });

    await logAction({ actor: req.user, action: 'delete', resource: 'department', resourceId: dept._id, resourceName: dept.name, req });
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete department.' });
  }
};
