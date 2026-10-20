const AuditLog = require('../models/AuditLog');

// GET /api/audit-logs
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, resource } = req.query;
    const pg   = Math.max(1, parseInt(page) || 1);
    const lim  = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pg - 1) * lim;

    const filter = {};
    if (action)   filter.action   = action;
    if (resource) filter.resource = resource;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
};
