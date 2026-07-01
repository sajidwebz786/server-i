const { sequelize, Task, UserTask, User, Package, Payment, Notification, Income } = require('../models');
const { creditIncome, money } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { Op } = require('sequelize');
const { earningPerAdForPackage } = require('../utils/plans');

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

async function approvedPackageIdsForUser(userId, options = {}) {
  const payments = await Payment.findAll({
    where: { userId, status: 'approved' },
    attributes: ['packageId'],
    transaction: options.transaction
  });
  return [...new Set(payments.map((payment) => payment.packageId).filter(Boolean))];
}

async function taskAccessWhereForUser(user, options = {}) {
  const packageIds = await approvedPackageIdsForUser(user.id, options);
  if (!packageIds.length) return null;
  return { status: 'active', [Op.or]: [{ packageId: null }, { packageId: { [Op.in]: packageIds } }] };
}

async function userCanAccessTask(user, task, options = {}) {
  if (!task.packageId) return true;
  const packageIds = await approvedPackageIdsForUser(user.id, options);
  return packageIds.includes(task.packageId);
}

function taskRewardAmount(task) {
  const plan = task?.package;
  if (plan) return money(earningPerAdForPackage(plan));
  if (Number(task?.rewardAmount || 0)) return money(task.rewardAmount);
  return 0.5;
}

async function creditTaskRewardOnce({ submission, task, taskDate }, options = {}) {
  const transaction = options.transaction;
  const existing = await Income.findOne({
    where: { userTaskId: submission.id, type: 'task', status: 'approved' },
    transaction
  });
  if (existing) return { credited: false, amount: Number(existing.amount || 0) };

  const amount = taskRewardAmount(task);
  if (amount <= 0) return { credited: false, amount: 0 };

  await creditIncome({
    userId: submission.userId,
    amount,
    category: 'task_income',
    referenceDate: taskDate,
    remarks: `Task reward: ${task.title}`,
    incomePayload: {
      userId: submission.userId,
      userTaskId: submission.id,
      type: 'task',
      amount,
      status: 'approved',
      remarks: `Automatically credited for ${taskDate}`
    }
  }, { transaction });
  return { credited: true, amount };
}

async function maybeNotifyTaskCompletion({ req, task, submission, taskDate, previousPercent, percent }) {
  if (previousPercent >= 100 || percent < 100) return;

  await notifyOnce({
    event: 'task_completed',
    title: 'Task completed',
    body: `${req.user.name || 'A member'} completed "${task.title}".`,
    data: { userId: req.user.id, taskId: task.id, userTaskId: submission.id, taskDate }
  });

  const assignedWhere = await taskAccessWhereForUser(req.user);
  if (!assignedWhere) return;
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
      body: `${req.user.name || 'A member'} completed all ${requiredCount} tasks for ${taskDate}.`,
      data: { userId: req.user.id, taskDate }
    });
  }
}

exports.list = asyncHandler(async (req, res) => {
  const packageIds = req.user.role === 'admin' ? [] : await approvedPackageIdsForUser(req.user.id);
  if (req.user.role !== 'admin' && !packageIds.length) {
    res.set('Cache-Control', 'no-store');
    return res.json({ tasks: [] });
  }

  const now = new Date();
  const taskDate = todayKey();
  const where = req.user.role === 'admin'
    ? {}
    : { status: 'active', [Op.or]: [{ packageId: null }, { packageId: { [Op.in]: packageIds } }] };
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
    order: [
      [{ model: Package, as: 'package' }, 'baseAmount', 'ASC'],
      ['packageId', 'ASC'],
      ['createdAt', 'ASC']
    ]
  });
  let visibleTasks = tasks
    .filter((task) => req.user.role === 'admin' || (!task.endsAt || task.endsAt >= now))
    .map((task) => {
      const plain = task.toJSON();
      const progress = plain.submissions?.[0];
      delete plain.submissions;
      return {
        ...plain,
        rewardAmount: taskRewardAmount(task),
        progress: progress ? {
          percent: Number(progress.watchPercent || 0),
          seconds: Number(progress.watchSeconds || 0),
          status: progress.status,
          taskDate: progress.taskDate,
          updatedAt: progress.updatedAt
        } : { percent: 0, seconds: 0, status: null, taskDate }
      };
    });
  if (req.user.role !== 'admin') {
    const assignedCountByPlan = new Map();
    visibleTasks = visibleTasks.filter((task) => {
      const key = task.packageId || 'free';
      const limit = Number(task.package?.dailyAdsRequired || task.package?.minAdsRequired || 20);
      const current = assignedCountByPlan.get(key) || 0;
      if (current >= limit) return false;
      assignedCountByPlan.set(key, current + 1);
      return true;
    });
  }
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
  await sequelize.transaction(async (transaction) => {
    const submissions = await UserTask.findAll({
      where: { taskId: task.id },
      attributes: ['id'],
      transaction
    });
    const submissionIds = submissions.map((item) => item.id);

    if (submissionIds.length) {
      await Income.update(
        { userTaskId: null },
        { where: { userTaskId: { [Op.in]: submissionIds } }, transaction }
      );
      await UserTask.destroy({ where: { id: { [Op.in]: submissionIds } }, transaction });
    }

    await task.destroy({ transaction });
  });
  res.json({ message: 'Task deleted successfully' });
});

exports.submit = asyncHandler(async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task || task.status !== 'active') throw new ApiError(404, 'Active task not found');
  if (!(await userCanAccessTask(req.user, task))) throw new ApiError(403, 'This task is not assigned to your approved plans');
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
  const task = await Task.findByPk(req.params.id, {
    include: [{ model: Package, as: 'package' }]
  });
  if (!task || task.status !== 'active') throw new ApiError(404, 'Active task not found');
  if (!(await userCanAccessTask(req.user, task))) throw new ApiError(403, 'This task is not assigned to your approved plans');

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
      watchedAt: percent > 0 ? new Date() : submission.watchedAt,
      status: percent >= 100 && submission.status === 'pending' ? 'submitted' : submission.status
    });
  }
  if (Number(submission.watchPercent || percent || 0) >= 100) {
    await sequelize.transaction(async (transaction) => {
      await creditTaskRewardOnce({ submission, task, taskDate }, { transaction });
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
    include: [{ model: Task, as: 'task', include: [{ model: Package, as: 'package' }] }, { model: User, as: 'user', include: [{ model: Package, as: 'package' }] }]
  });
  if (!submission) throw new ApiError(404, 'Task submission not found');
  if (submission.status === 'approved') throw new ApiError(400, 'Submission is already approved');
  if (Number(submission.watchPercent || 0) < 100) throw new ApiError(400, 'Task is not fully completed yet');

  await sequelize.transaction(async (transaction) => {
    await submission.update({
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      adminRemarks: req.body.adminRemarks || null
    }, { transaction });

    await creditTaskRewardOnce({
      submission,
      task: submission.task,
      taskDate: submission.taskDate
    }, { transaction });

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
