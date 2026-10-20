const router = require('express').Router();
const ctrl = require('../controllers/leaveController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',           ctrl.list);
router.post('/',          ctrl.create);
router.get('/:id',        ctrl.getOne);
router.patch('/:id/review', requireRole('admin','hr_manager'), ctrl.review);
router.delete('/:id',     ctrl.cancel);

module.exports = router;
