const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole('admin','hr_manager'));

router.get('/stats',                  ctrl.stats);
router.get('/department-distribution',ctrl.departmentDistribution);
router.get('/hiring-trends',          ctrl.hiringTrends);

module.exports = router;
