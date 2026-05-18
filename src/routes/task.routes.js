const router = require('express').Router();
const controller = require('../controllers/task.controller');
const validate = require('../middleware/validate');
const { auth, requireRole } = require('../middleware/auth');
const { uploader } = require('../middleware/upload');
const schemas = require('../validators/schemas');

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task list
 *   post:
 *     tags: [Tasks]
 *     summary: Admin create promotion task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskRequest'
 *     responses:
 *       201:
 *         description: Task created
 */
router.get('/', auth, controller.list);
router.post('/', auth, requireRole('admin'), validate(schemas.createTask), controller.create);
/**
 * @swagger
 * /api/tasks/{id}/submit:
 *   post:
 *     tags: [Tasks]
 *     summary: Submit screenshot proof for a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               screenshot: { type: string, format: binary }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Task submitted
 */
router.put('/:id', auth, requireRole('admin'), validate(schemas.task), controller.update);
router.delete('/:id', auth, requireRole('admin'), controller.remove);
router.post('/:id/submit', auth, uploader('tasks').single('screenshot'), validate(schemas.taskSubmit), controller.submit);
/**
 * @swagger
 * /api/tasks/my/submissions:
 *   get:
 *     tags: [Tasks]
 *     summary: List logged-in user's task submissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Submission list
 */
router.get('/my/submissions', auth, controller.mySubmissions);
/**
 * @swagger
 * /api/tasks/admin/submissions:
 *   get:
 *     tags: [Tasks]
 *     summary: Admin list task submissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, submitted, approved, rejected] }
 *     responses:
 *       200:
 *         description: Submission list
 */
router.get('/admin/submissions', auth, requireRole('admin'), controller.submissions);
router.put('/admin/submissions/:id/approve', auth, requireRole('admin'), validate(schemas.taskApproval), controller.approveSubmission);
router.put('/admin/submissions/:id/reject', auth, requireRole('admin'), validate(schemas.adminRemarks), controller.rejectSubmission);

module.exports = router;
