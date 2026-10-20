const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { logAction } = require('../utils/auditLogger');

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── GET /api/attendance/today ──────────────────────────────
exports.getToday = async (req, res) => {
  try {
    const today = getTodayString();
    const query = { date: today };

    // Employee role can only see their own attendance
    if (req.user.role === 'employee' && req.user.employeeRef) {
      query.employee = req.user.employeeRef;
    }

    const records = await Attendance.find(query)
      .populate('employee', 'name employeeId designation department profilePhoto')
      .sort({ checkIn: -1 })
      .lean();

    const [totalActive, totalPresent, totalLate] = await Promise.all([
      Employee.countDocuments({ status: 'active' }),
      Attendance.countDocuments({ date: today, status: { $in: ['present', 'late', 'half_day'] } }),
      Attendance.countDocuments({ date: today, status: 'late' }),
    ]);

    res.json({
      date: today,
      stats: {
        totalActive,
        present: totalPresent,
        late: totalLate,
        absent: Math.max(0, totalActive - totalPresent),
        attendanceRate: totalActive > 0 ? Math.round((totalPresent / totalActive) * 100) : 0,
      },
      records,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance.' });
  }
};

// ─── GET /api/attendance/stats ──────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const today = getTodayString();
    const [totalActive, totalPresent, totalLate] = await Promise.all([
      Employee.countDocuments({ status: 'active' }),
      Attendance.countDocuments({ date: today, status: { $in: ['present', 'late', 'half_day'] } }),
      Attendance.countDocuments({ date: today, status: 'late' }),
    ]);

    res.json({
      date: today,
      totalActive,
      present: totalPresent,
      late: totalLate,
      absent: Math.max(0, totalActive - totalPresent),
      attendanceRate: totalActive > 0 ? Math.round((totalPresent / totalActive) * 100) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance stats.' });
  }
};

// ─── POST /api/attendance/clock-in ──────────────────────────
exports.clockIn = async (req, res) => {
  try {
    const today = getTodayString();
    let employeeId = req.body.employeeId;

    if (req.user.role === 'employee') {
      employeeId = req.user.employeeRef;
    } else if (!employeeId) {
      employeeId = req.user.employeeRef;
    }

    if (!employeeId) {
      // If admin doesn't have an employeeRef and didn't specify one, pick first active employee or error
      const emp = await Employee.findOne({ status: 'active' });
      if (emp) employeeId = emp._id;
      else return res.status(400).json({ error: 'Employee profile is required for clock-in.' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    let record = await Attendance.findOne({ employee: employee._id, date: today });
    if (record) {
      return res.status(400).json({ error: 'Already clocked in for today.', record });
    }

    const now = new Date();
    // If checkIn after 10:00 AM, mark as 'late'
    const isLate = now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() > 15);

    record = await Attendance.create({
      employee: employee._id,
      date: today,
      checkIn: now,
      status: isLate ? 'late' : 'present',
    });

    await record.populate('employee', 'name employeeId designation');

    await logAction({
      actor: req.user,
      action: 'clock_in',
      resource: 'attendance',
      resourceId: record._id,
      resourceName: employee.name,
      req,
    });

    res.status(201).json({
      message: `Clocked in successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      record,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clock in.' });
  }
};

// ─── POST /api/attendance/clock-out ─────────────────────────
exports.clockOut = async (req, res) => {
  try {
    const today = getTodayString();
    let employeeId = req.body.employeeId;

    if (req.user.role === 'employee' || !employeeId) {
      employeeId = req.user.employeeRef;
    }

    if (!employeeId) {
      const emp = await Employee.findOne({ status: 'active' });
      if (emp) employeeId = emp._id;
      else return res.status(400).json({ error: 'Employee profile is required for clock-out.' });
    }

    const record = await Attendance.findOne({ employee: employeeId, date: today });
    if (!record) {
      return res.status(400).json({ error: 'No clock-in record found for today.' });
    }

    if (record.checkOut) {
      return res.status(400).json({ error: 'Already clocked out for today.', record });
    }

    const now = new Date();
    record.checkOut = now;
    const diffMs = now.getTime() - record.checkIn.getTime();
    record.workHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

    if (record.workHours < 4) {
      record.status = 'half_day';
    }

    await record.save();
    await record.populate('employee', 'name employeeId designation');

    await logAction({
      actor: req.user,
      action: 'clock_out',
      resource: 'attendance',
      resourceId: record._id,
      resourceName: record.employee.name,
      req,
    });

    res.json({
      message: `Clocked out successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${record.workHours} hrs logged).`,
      record,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clock out.' });
  }
};
