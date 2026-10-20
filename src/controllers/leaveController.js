const LeaveRequest = require('../models/LeaveRequest');
const Employee     = require('../models/Employee');
const { logAction }= require('../utils/auditLogger');

function calcDays(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.max(0.5, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}

// GET /api/leaves
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, employee: empId } = req.query;
    const pg   = Math.max(1, parseInt(page) || 1);
    const lim  = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pg - 1) * lim;

    const filter = {};
    if (req.user.role === 'employee') {
      if (!req.user.employeeRef)
        return res.json({ leaves: [], pagination: { total: 0, page: pg, limit: lim, pages: 0 } });
      filter.employee = req.user.employeeRef;
    } else if (empId) {
      filter.employee = empId;
    }
    if (status) filter.status = status;

    const [leaves, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate('employee', 'name employeeId department')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      LeaveRequest.countDocuments(filter),
    ]);

    res.json({ leaves, pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave requests.' });
  }
};

// GET /api/leaves/:id
exports.getOne = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id)
      .populate('employee', 'name employeeId')
      .populate('reviewedBy', 'name');

    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    if (req.user.role === 'employee' &&
        leave.employee._id.toString() !== req.user.employeeRef?.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json({ leave });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave request.' });
  }
};

// POST /api/leaves
exports.create = async (req, res) => {
  try {
    const { type, startDate, endDate, reason, employee: empId } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Type, start date, end date, and reason are required.' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date cannot be before start date.' });
    }

    let employeeDoc;
    if (req.user.role === 'employee') {
      if (!req.user.employeeRef)
        return res.status(400).json({ error: 'No employee profile linked to your account.' });
      employeeDoc = await Employee.findById(req.user.employeeRef);
    } else {
      if (!empId) return res.status(400).json({ error: 'Employee ID is required.' });
      employeeDoc = await Employee.findById(empId);
      if (!employeeDoc) return res.status(404).json({ error: 'Employee not found.' });
    }

    const leave = await LeaveRequest.create({
      employee: employeeDoc._id,
      type,
      startDate: new Date(startDate),
      endDate:   new Date(endDate),
      days:      calcDays(startDate, endDate),
      reason:    String(reason).trim(),
    });

    await leave.populate('employee', 'name employeeId');
    res.status(201).json({ leave, message: 'Leave request submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit leave request.' });
  }
};

// PATCH /api/leaves/:id/review
exports.review = async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status must be "approved" or "rejected".' });

    const leave = await LeaveRequest.findById(req.params.id).populate('employee', 'name employeeId');
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
    if (leave.status !== 'pending')
      return res.status(400).json({ error: 'This request has already been reviewed.' });

    leave.status     = status;
    leave.reviewedBy = req.user._id;
    leave.reviewNote = reviewNote?.trim();
    leave.reviewedAt = new Date();
    await leave.save();

    // Update employee status if approved and dates overlap today
    if (status === 'approved') {
      const today = new Date();
      if (new Date(leave.startDate) <= today && new Date(leave.endDate) >= today) {
        await Employee.findByIdAndUpdate(leave.employee._id, { status: 'on_leave' });
      }
    }

    await logAction({
      actor: req.user, action: 'status_change', resource: 'leave',
      resourceId: leave._id, resourceName: `${leave.employee.name} ${leave.type} leave`,
      changes: { status, reviewNote }, req,
    });

    res.json({ leave, message: `Leave request ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review leave request.' });
  }
};

// DELETE /api/leaves/:id
exports.cancel = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    if (req.user.role === 'employee') {
      if (leave.employee.toString() !== req.user.employeeRef?.toString())
        return res.status(403).json({ error: 'Access denied.' });
      if (leave.status !== 'pending')
        return res.status(400).json({ error: 'Only pending leave requests can be cancelled.' });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Leave request cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel leave request.' });
  }
};
