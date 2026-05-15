const router = require('express').Router();
const controller = require('../controllers/withdrawal.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/withdrawals/request:
 *   post:
 *     tags: [Withdrawals]
 *     summary: Request wallet withdrawal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WithdrawalRequest'
 *     responses:
 *       201:
 *         description: Withdrawal requested
 */
router.post('/request', auth, validate(schemas.withdrawal), controller.request);
/**
 * @swagger
 * /api/withdrawals/my:
 *   get:
 *     tags: [Withdrawals]
 *     summary: List logged-in user's withdrawals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal list
 */
router.get('/my', auth, controller.myWithdrawals);
/**
 * @swagger
 * /api/withdrawals/admin:
 *   get:
 *     tags: [Withdrawals]
 *     summary: Admin list withdrawals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, paid] }
 *     responses:
 *       200:
 *         description: Withdrawal list
 */
router.get('/admin', auth, requireRole('admin'), controller.adminList);
router.put('/admin/:id/approve', auth, requireRole('admin'), validate(schemas.adminRemarks), controller.approve);
router.put('/admin/:id/reject', auth, requireRole('admin'), validate(schemas.adminRemarks), controller.reject);
router.put('/admin/:id/paid', auth, requireRole('admin'), controller.markPaid);

module.exports = router;
