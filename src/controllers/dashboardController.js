const Employee    = require('../models/Employee');
const Department  = require('../models/Department');
const LeaveRequest= require('../models/LeaveRequest');

// GET /api/dashboard/stats
exports.stats = async (_req, res) => {
  try {
    const [total, active, inactive, onLeave, departments, pendingLeaves] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: 'active' }),
      Employee.countDocuments({ status: 'inactive' }),
      Employee.countDocuments({ status: 'on_leave' }),
      Department.countDocuments(),
      LeaveRequest.countDocuments({ status: 'pending' }),
    ]);

    const payrollAgg = await Employee.aggregate([
      { $match: { status: { $in: ['active', 'on_leave'] } } },
      { $group: { _id: null, total: { $sum: '$salary' } } },
    ]);
    const monthlyPayroll = payrollAgg[0]?.total || 0;

    const recentEmployees = await Employee.find()
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name employeeId designation department status profilePhoto createdAt')
      .lean();

    res.json({ stats: { total, active, inactive, onLeave, departments, monthlyPayroll, pendingLeaves }, recentEmployees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
};

// GET /api/dashboard/department-distribution
exports.departmentDistribution = async (_req, res) => {
  try {
    const distribution = await Employee.aggregate([
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $group: {
        _id:    '$dept.name',
        total:  { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
      }},
      { $sort: { total: -1 } },
    ]);
    res.json({ distribution });
  } catch (err) {
    console.error('Department distribution error:', err);
    res.status(500).json({ error: 'Failed to fetch department distribution.' });
  }
};

// GET /api/dashboard/hiring-trends
exports.hiringTrends = async (_req, res) => {
  try {
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const trends = await Employee.aggregate([
      { $match: { joiningDate: { $gte: start } } },
      { $group: {
        _id: { year: { $year: '$joiningDate' }, month: { $month: '$joiningDate' } },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    res.json({ trends });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hiring trends.' });
  }
};
