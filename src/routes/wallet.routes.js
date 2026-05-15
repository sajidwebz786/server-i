const router = require('express').Router();
const controller = require('../controllers/wallet.controller');
const validate = require('../middleware/validate');
const { auth } = require('../middleware/auth');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet summary and latest transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet summary
 */
router.get('/', auth, controller.summary);
/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet transaction history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction list
 */
router.get('/transactions', auth, controller.transactions);
/**
 * @swagger
 * /api/wallet/bank-details:
 *   get:
 *     tags: [Wallet]
 *     summary: Get bank or UPI payout details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank details
 *   put:
 *     tags: [Wallet]
 *     summary: Add or update bank or UPI payout details
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BankDetailRequest'
 *     responses:
 *       200:
 *         description: Bank details saved
 */
router.get('/bank-details', auth, controller.bank);
router.put('/bank-details', auth, validate(schemas.bank), controller.upsertBank);

module.exports = router;
