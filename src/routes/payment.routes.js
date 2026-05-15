const router = require('express').Router();
const controller = require('../controllers/payment.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/payments/create:
 *   post:
 *     tags: [Payments]
 *     summary: Create a package payment with optional proof screenshot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/PaymentRequest'
 *     responses:
 *       201:
 *         description: Payment submitted
 */
router.post('/create', auth, uploader('payments').single('screenshot'), validate(schemas.payment), controller.create);
router.post('/upload-proof', auth, uploader('payments').single('screenshot'), validate(schemas.payment), controller.create);
/**
 * @swagger
 * /api/payments/my:
 *   get:
 *     tags: [Payments]
 *     summary: List logged-in user's payments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment list
 */
router.get('/my', auth, controller.myPayments);
/**
 * @swagger
 * /api/payments/admin:
 *   get:
 *     tags: [Payments]
 *     summary: Admin list payments, optionally by status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *     responses:
 *       200:
 *         description: Payment list
 */
router.get('/admin/pending', auth, requireRole('admin'), controller.pending);
router.get('/admin', auth, requireRole('admin'), controller.pending);
/**
 * @swagger
 * /api/payments/admin/{id}/approve:
 *   put:
 *     tags: [Payments]
 *     summary: Approve payment and credit referral income
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminRemarksRequest'
 *     responses:
 *       200:
 *         description: Payment approved
 */
router.put('/admin/:id/approve', auth, requireRole('admin'), validate(schemas.adminRemarks), controller.approve);
/**
 * @swagger
 * /api/payments/admin/{id}/reject:
 *   put:
 *     tags: [Payments]
 *     summary: Reject payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminRemarksRequest'
 *     responses:
 *       200:
 *         description: Payment rejected
 */
router.put('/admin/:id/reject', auth, requireRole('admin'), validate(schemas.adminRemarks), controller.reject);

module.exports = router;
