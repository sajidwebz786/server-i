const router = require('express').Router();
const controller = require('../controllers/package.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/packages:
 *   get:
 *     tags: [Packages]
 *     summary: List active packages for users, or all packages for admins
 *     responses:
 *       200:
 *         description: Package list
 *   post:
 *     tags: [Packages]
 *     summary: Create package
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PackageRequest'
 *     responses:
 *       201:
 *         description: Package created
 */
router.get('/', controller.list);
router.post('/', auth, requireRole('admin'), validate(schemas.createPackage), controller.create);
/**
 * @swagger
 * /api/packages/{id}:
 *   put:
 *     tags: [Packages]
 *     summary: Update package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PackageRequest'
 *     responses:
 *       200:
 *         description: Package updated
 *   delete:
 *     tags: [Packages]
 *     summary: Delete package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Package deleted
 */
router.put('/:id', auth, requireRole('admin'), validate(schemas.package), controller.update);
router.patch('/:id/status', auth, requireRole('admin'), validate(schemas.packageStatus), controller.setStatus);
/**
 * @swagger
 * /api/packages/{id}/income-settings:
 *   put:
 *     tags: [Packages]
 *     summary: Configure level-wise referral income percentages for a package
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settings]
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [level, percentage]
 *                   properties:
 *                     level: { type: integer, example: 1 }
 *                     percentage: { type: number, example: 10 }
 *                     status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Income settings saved
 */
router.put('/:id/income-settings', auth, requireRole('admin'), validate(schemas.incomeSettings), controller.upsertIncomeSettings);
router.delete('/:id', auth, requireRole('admin'), controller.remove);

module.exports = router;
