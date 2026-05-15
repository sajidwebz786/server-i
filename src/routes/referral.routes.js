const router = require('express').Router();
const controller = require('../controllers/referral.controller');
const { auth, requireRole } = require('../middleware/auth');

/**
 * @swagger
 * /api/referrals/tree:
 *   get:
 *     tags: [Referrals]
 *     summary: Get logged-in user's referral tree
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: depth
 *         schema: { type: integer, example: 5 }
 *     responses:
 *       200:
 *         description: Referral tree
 */
router.get('/tree', auth, controller.myTree);
/**
 * @swagger
 * /api/referrals/downline:
 *   get:
 *     tags: [Referrals]
 *     summary: Get logged-in user's level-wise downline
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Downline list
 */
router.get('/downline', auth, controller.downline);
/**
 * @swagger
 * /api/referrals/income:
 *   get:
 *     tags: [Referrals]
 *     summary: Get logged-in user's referral and task income history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Income list
 */
router.get('/income', auth, controller.myIncomes);
router.get('/admin/:userId/tree', auth, requireRole('admin'), controller.adminTree);
router.get('/admin/:userId/downline', auth, requireRole('admin'), controller.downline);

module.exports = router;
