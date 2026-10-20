const User = require('../models/User');

/**
 * Middleware: require a valid session.
 * Attaches req.user if authenticated.
 */
exports.requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication check failed.' });
  }
};

/**
 * Middleware: require one of the specified roles.
 * Must be used after requireAuth.
 */
exports.requireRole = (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };

/**
 * Middleware: allow if user has the required role OR is accessing their own employee record.
 */
exports.requireSelfOrRole = (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (roles.includes(req.user.role)) return next();
    // Employee accessing own record
    if (
      req.user.role === 'employee' &&
      req.user.employeeRef &&
      req.user.employeeRef.toString() === req.params.id
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied.' });
  };
