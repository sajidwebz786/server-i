const { sequelize, Task, UserTask, User, Package, Notification } = require('../models');
const { creditIncome, money } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

exports.list = asyncHandler(async (req, res) => {
  const now = new Date();
  const tasks = await Task.findAll({
    where: req.user.role === 'admin' ? {} : { status: 'active' },
    include: [{ model: Package, as: 'package' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({
    tasks: tasks.filter((task) => req.user.role === 'admin' || (!task.endsAt || task.endsAt >= now))
  });
});

exports.create = asyncHandler(async (req, res) => {
  const task = await Task.create(req.body);
  res.status(201).json({ task });
});

exports.update = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  await task.update(req.body);
  res.json({ task });
});

exports.submit = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task || task.status !== 'active') throw new ApiError(404, 'Active task not found');

  const [submission, created] = await UserTask.findOrCreate({
    where: { userId: req.user.id, taskId: task.id },
    defaults: {
      userId: req.user.id,
      taskId: task.id,
      screenshot: req.file ? `/uploads/tasks/${req.file.filename}` : null,
      notes: req.body.notes || null,
      status: 'submitted'
    }
  });

  if (!created) {
    if (submission.status === 'approved') throw new ApiError(400, 'Task is already approved');
    await submission.update({
      screenshot: req.file ? `/uploads/tasks/${req.file.filename}` : submission.screenshot,
      notes: req.body.notes || submission.notes,
      status: 'submitted',
      adminRemarks: null
    });
  }

  res.status(created ? 201 : 200).json({ submission });
});

exports.mySubmissions = asyncHandler(async (req, res) => {
  const submissions = await UserTask.findAll({
    where: { userId: req.user.id },
    include: [{ model: Task, as: 'task' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ submissions });
});

exports.submissions = asyncHandler(async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const submissions = await UserTask.findAll({
    where,
    include: [{ model: User, as: 'user' }, { model: Task, as: 'task' }],
    order: [['createdAt', 'DESC']]
  });
  res.json({ submissions });
});

exports.approveSubmission = asyncHandler(async (req, res) => {
  const submission = await UserTask.findByPk(req.params.id, {
    include: [{ model: Task, as: 'task' }, { model: User, as: 'user' }]
  });
  if (!submission) throw new ApiError(404, 'Task submission not found');
  if (submission.status === 'approved') throw new ApiError(400, 'Submission is already approved');

  await sequelize.transaction(async (transaction) => {
    await submission.update({
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminRemarks: req.body.adminRemarks || null
    }, { transaction });

    const amount = money(req.body.rewardAmount || submission.task.rewardAmount);
    if (amount > 0) {
      await creditIncome({
        userId: submission.userId,
        amount,
        category: 'task_income',
        remarks: `Task reward: ${submission.task.title}`,
        incomePayload: {
          userId: submission.userId,
          userTaskId: submission.id,
          type: 'task',
          amount,
          status: 'approved'
        }
      }, { transaction });
    }

    await Notification.create({
      userId: submission.userId,
      title: 'Task approved',
      body: `Your task "${submission.task.title}" was approved.`,
      type: 'task',
      data: { userTaskId: submission.id }
    }, { transaction });
  });

  res.json({ submission: await UserTask.findByPk(submission.id) });
});

exports.rejectSubmission = asyncHandler(async (req, res) => {
  const submission = await UserTask.findByPk(req.params.id);
  if (!submission) throw new ApiError(404, 'Task submission not found');
  await submission.update({ status: 'rejected', adminRemarks: req.body.adminRemarks || null });
  await Notification.create({
    userId: submission.userId,
    title: 'Task rejected',
    body: req.body.adminRemarks || 'Your task proof was rejected.',
    type: 'task',
    data: { userTaskId: submission.id }
  });
  res.json({ submission });
});
