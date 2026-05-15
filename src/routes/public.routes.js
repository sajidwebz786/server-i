const router = require('express').Router();
const controller = require('../controllers/public.controller');

/**
 * @swagger
 * /api/public/home:
 *   get:
 *     tags: [Public]
 *     summary: Get public website/mobile home bootstrap content
 *     responses:
 *       200:
 *         description: Company services, active banners, packages, and latest tasks
 */
router.get('/home', controller.home);

module.exports = router;
