const router = require('express').Router();
const ctrl = require('../controllers/auditLogController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole('admin')); // Audit logs are admin-only

router.get('/', ctrl.list);

module.exports = router;
