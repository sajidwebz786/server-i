const router = require('express').Router();

router.use('/public', require('./public.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/packages', require('./package.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/referrals', require('./referral.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/wallet', require('./wallet.routes'));
router.use('/withdrawals', require('./withdrawal.routes'));
router.use('/support', require('./support.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
