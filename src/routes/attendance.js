const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/today', ctrl.getToday);
router.get('/stats', ctrl.getStats);
router.post('/clock-in', ctrl.clockIn);
router.post('/clock-out', ctrl.clockOut);

module.exports = router;
