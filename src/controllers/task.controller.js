const { sequelize, Task, UserTask, User, Package, Notification } = require('../models');
const { creditIncome, money } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { Op } = require('sequelize');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function notifyOnce({ event, title, body, data }) {
  const existing = await Notification.findOne({
    where: {
      type: 'task',
      data: { [Op.contains]: { event, ...data } }
    }
  });
  if (existing) return existing;
  return Notification.create({
    userId: null,
    title,
    body,
    type: 'task',
    data: { event, ...data }
  });
}

async function maybeNotifyTaskCompletion({ req, task, submission, taskDate, previousPercent, percent }) {
  if (previousPercent >= 100 || percent < 100) return;

  await notifyOnce({
    event: 'task_completed',
    title: 'Video task completed',
    body: `${req.user.name || 'A member'} fully watched "${task.title}".`,
    data: { userId: req.user.id, taskId: task.id, userTaskId: submission.id, taskDate }
  });

  const assignedWhere = {
    status: 'active',
    [Op.or]: [{ packageId: null }, { packageId: req.user.packageId }]
  };
  const requiredCount = await Task.count({ where: assignedWhere });
  if (!requiredCount) return;

  const completedCount = await UserTask.count({
    where: {
      userId: req.user.id,
      taskDate,
      watchPercent: { [Op.gte]: 100 }
    },
    include: [{
      model: Task,
      as: 'task',
      required: true,
      where: assignedWhere
    }]
  });

  if (completedCount >= requiredCount) {
    await notifyOnce({
      event: 'daily_tasks_completed',
      title: 'Daily tasks completed',
      body: `${req.user.name || 'A member'} completed all ${requiredCount} video tasks for ${taskDate}.`,
      data: { userId: req.user.id, taskDate }
    });
  }
}

exports.list = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.packageId) {
    res.set('Cache-Control', 'no-store');
    return res.json({ tasks: [] });
  }

  const now = new Date();
  const taskDate = todayKey();
  const where = req.user.role === 'admin'
    ? {}
    : { status: 'active', [Op.or]: [{ packageId: null }, { packageId: req.user.packageId }] };
  const tasks = await Task.findAll({
    where,
    include: [
      { model: Package, as: 'package' },
      ...(req.user.role === 'admin' ? [] : [{
        model: UserTask,
        as: 'submissions',
        required: false,
        where: { userId: req.user.id, taskDate }
      }])
    ],
    order: [['createdAt', 'DESC']]
  });
  const visibleTasks = tasks
    .filter((task) => req.user.role === 'admin' || (!task.endsAt || task.endsAt >= now))
    .map((task) => {
      const plain = task.toJSON();
      const progress = plain.submissions?.[0];
      delete plain.submissions;
      return {
        ...plain,
        progress: progress ? {
          percent: Number(progress.watchPercent || 0),
          seconds: Number(progress.watchSeconds || 0),
          status: progress.status,
          taskDate: progress.taskDate,
          updatedAt: progress.updatedAt
        } : { percent: 0, seconds: 0, status: null, taskDate }
      };
    });
  res.set('Cache-Control', 'no-store');
  res.json({ tasks: visibleTasks });
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

exports.remove = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  await task.destroy();
  res.status(204).send();
});

exports.submit = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task || task.status !== 'active') throw new ApiError(404, 'Active task not found');
  if (task.packageId && task.packageId !== req.user.packageId) throw new ApiError(403, 'This task is not assigned to your plan');
  const taskDate = req.body.taskDate ? new Date(req.body.taskDate).toISOString().slice(0, 10) : todayKey();

  const [submission, created] = await UserTask.findOrCreate({
    where: { userId: req.user.id, taskId: task.id, taskDate },
    defaults: {
      userId: req.user.id,
      taskId: task.id,
      taskDate,
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

exports.saveProgress = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task || task.status !== 'active') throw new ApiError(404, 'Active task not found');
  if (task.packageId && task.packageId !== req.user.packageId) throw new ApiError(403, 'This task is not assigned to your plan');

  const taskDate = req.body.taskDate ? new Date(req.body.taskDate).toISOString().slice(0, 10) : todayKey();
  const percent = Math.min(100, Math.max(0, Math.round(Number(req.body.percent || 0))));
  const seconds = Math.max(0, Math.round(Number(req.body.seconds || 0)));

  const [submission] = await UserTask.findOrCreate({
    where: { userId: req.user.id, taskId: task.id, taskDate },
    defaults: {
      userId: req.user.id,
      taskId: task.id,
      taskDate,
      status: 'pending',
      watchPercent: percent,
      watchSeconds: seconds,
      watchedAt: percent > 0 ? new Date() : null
    }
  });

  const previousPercent = Number(submission.watchPercent || 0);
  if (submission.watchPercent < percent || submission.watchSeconds < seconds) {
    await submission.update({
      watchPercent: Math.max(Number(submission.watchPercent || 0), percent),
      watchSeconds: Math.max(Number(submission.watchSeconds || 0), seconds),
      watchedAt: percent > 0 ? new Date() : submission.watchedAt
    });
  }
  await maybeNotifyTaskCompletion({ req, task, submission, taskDate, previousPercent, percent: Number(submission.watchPercent || percent || 0) });

  res.json({
    progress: {
      taskId: task.id,
      taskDate,
      percent: Number(submission.watchPercent || percent || 0),
      seconds: Number(submission.watchSeconds || seconds || 0),
      status: submission.status,
      updatedAt: submission.updatedAt
    }
  });
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
    include: [{ model: Task, as: 'task' }, { model: User, as: 'user', include: [{ model: Package, as: 'package' }] }]
  });
  if (!submission) throw new ApiError(404, 'Task submission not found');
  if (submission.status === 'approved') throw new ApiError(400, 'Submission is already approved');
  if (Number(submission.watchPercent || 0) < 100) throw new ApiError(400, 'Video is not fully watched yet');

  await sequelize.transaction(async (transaction) => {
    await submission.update({
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminRemarks: req.body.adminRemarks || null
    }, { transaction });

    const plan = submission.user?.package;
    const planPerAd = plan && Number(plan.dailyAdsRequired || 0)
      ? money(Number(plan.monthlyGenerationAmount || 0) / 30 / Number(plan.dailyAdsRequired || 1))
      : 0;
    const amount = money(req.body.rewardAmount || submission.task.rewardAmount || planPerAd);
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
