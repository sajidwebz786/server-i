const router = require('express').Router();
const controller = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', controller.list);
router.put('/:id/read', controller.markRead);

module.exports = router;
