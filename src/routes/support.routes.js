const router = require('express').Router();
const controller = require('../controllers/support.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/support:
 *   post:
 *     tags: [Support]
 *     summary: Create support ticket
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupportTicketRequest'
 *     responses:
 *       201:
 *         description: Ticket created
 */
router.post('/', auth, validate(schemas.ticket), controller.create);
/**
 * @swagger
 * /api/support/my:
 *   get:
 *     tags: [Support]
 *     summary: List logged-in user's support tickets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket list
 */
router.get('/my', auth, controller.myTickets);
/**
 * @swagger
 * /api/support/admin:
 *   get:
 *     tags: [Support]
 *     summary: Admin list support tickets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket list
 */
router.get('/admin', auth, requireRole('admin'), controller.adminTickets);
router.post('/:id/replies', auth, validate(schemas.reply), controller.reply);
router.patch('/:id/close', auth, controller.close);

module.exports = router;
