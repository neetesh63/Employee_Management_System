const AuditLog = require('../models/AuditLog');

/**
 * Write an audit log entry.
 * Errors are silently caught so a logging failure never breaks a request.
 *
 * @param {Object} opts
 * @param {Object} opts.actor        - User document (or { name, role } plain object)
 * @param {string} opts.action       - Action taken
 * @param {string} opts.resource     - Resource type ('employee', 'department', …)
 * @param {*}      [opts.resourceId] - ID of the affected document
 * @param {string} [opts.resourceName]
 * @param {Object} [opts.changes]    - Before/after snapshot
 * @param {Object} [opts.req]        - Express request (for IP / user-agent)
 */
const logAction = async ({ actor, action, resource, resourceId, resourceName, changes, req }) => {
  try {
    await AuditLog.create({
      actor: actor?._id || null,
      actorName: actor?.name || 'System',
      actorRole: actor?.role || 'system',
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      resourceName,
      changes,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    // Never let audit failure break the main request
    console.error('⚠  Audit log write failed:', err.message);
  }
};

module.exports = { logAction };
