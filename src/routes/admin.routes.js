const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const schemas = require('../validators/schemas');

router.use(auth, requireRole('admin'));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Admin dashboard counts and totals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard totals
 */
router.get('/dashboard', controller.dashboard);
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Admin list users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, active, inactive, blocked] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User list
 */
router.get('/users', controller.users);
router.put('/users/:id', validate(schemas.updateUser), controller.updateUser);
router.delete('/users/:id', controller.deleteUser);
router.delete('/users/:id/permanent', controller.deleteUserPermanent);
router.put('/users/:id/reset-password', validate(schemas.resetPassword), controller.resetPassword);
/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: Admin financial and activity reports
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report data
 */
router.get('/reports', controller.reports);
router.get('/transactions', controller.transactions);
router.post('/daily-debits/run', validate(schemas.dailyDebitRun), controller.runDailyDebits);

/**
 * @swagger
 * /api/admin/banners:
 *   get:
 *     tags: [Admin]
 *     summary: List banners
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Banner list
 *   post:
 *     tags: [Admin]
 *     summary: Create banner
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/BannerRequest'
 *     responses:
 *       201:
 *         description: Banner created
 */
router.get('/banners', controller.banners);
router.post('/banners', uploader('banners').single('image'), validate(schemas.banner), controller.createBanner);
router.put('/banners/:id', uploader('banners').single('image'), validate(schemas.bannerUpdate), controller.updateBanner);
router.delete('/banners/:id', controller.deleteBanner);

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     tags: [Admin]
 *     summary: List admin notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification list
 *   post:
 *     tags: [Admin]
 *     summary: Broadcast or send notification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationRequest'
 *     responses:
 *       201:
 *         description: Notification created
 */
router.get('/notifications', controller.notifications);
router.post('/notifications', validate(schemas.notification), controller.broadcast);

module.exports = router;
