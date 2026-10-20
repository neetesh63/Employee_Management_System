const router = require('express').Router();
const ctrl = require('../controllers/employeeController');
const { requireAuth, requireRole, requireSelfOrRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',                 requireRole('admin','hr_manager'),        ctrl.list);
router.get('/export',           requireRole('admin','hr_manager'),        ctrl.exportCSV);
router.post('/',                requireRole('admin','hr_manager'),        ctrl.create);
router.patch('/bulk/status',    requireRole('admin','hr_manager'),        ctrl.bulkUpdateStatus);
router.get('/:id/salary-slip',  requireSelfOrRole('admin','hr_manager'),  ctrl.getSalarySlip);
router.get('/:id',              requireSelfOrRole('admin','hr_manager'),  ctrl.getOne);
router.put('/:id',              requireRole('admin','hr_manager'),        ctrl.update);
router.delete('/:id',           requireRole('admin'),                     ctrl.remove);
router.patch('/:id/status',     requireRole('admin','hr_manager'),        ctrl.updateStatus);

module.exports = router;
