const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Denormalized so logs survive user deletion
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: {
      type: String,
      enum: [
        'create', 'update', 'delete',
        'login', 'logout', 'login_failed',
        'status_change', 'bulk_update', 'export',
        'clock_in', 'clock_out',
      ],
      required: true,
    },
    resource: { type: String, required: true },   // 'employee', 'department', etc.
    resourceId: { type: String },
    resourceName: { type: String },
    changes: { type: mongoose.Schema.Types.Mixed }, // before/after for updates
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ resource: 1, action: 1 });

// Auto-expire logs after 1 year (optional: comment out if you want to keep forever)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
