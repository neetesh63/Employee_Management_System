const router = require('express').Router();
const ctrl = require('../controllers/departmentController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',       ctrl.list);
router.get('/:id',    ctrl.getOne);
router.post('/',      requireRole('admin','hr_manager'), ctrl.create);
router.put('/:id',    requireRole('admin','hr_manager'), ctrl.update);
router.delete('/:id', requireRole('admin'),              ctrl.remove);

module.exports = router;
