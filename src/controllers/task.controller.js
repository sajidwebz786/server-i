const { sequelize, Task, UserTask, User, Package, Payment, Notification, Income } = require('../models');
const { creditIncome, money } = require('../services/wallet.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { uploadedFileUrl } = require('../middleware/upload');
const { Op } = require('sequelize');
const { earningPerAdForPackage } = require('../utils/plans');

const FREE_AD_LIMIT = 10;
const FREE_AD_REWARD = 0.5;
const FREE_DIRECT_REFERRAL_PERCENT = 10;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hasActivePackage(user) {
  return Boolean(user?.packageId && user.status === 'active' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) >= new Date()));
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

async function activePackageIdsForUser(user, options = {}) {
  if (hasActivePackage(user)) {
    return [user.packageId];
  }
  return approvedPackageIdsForUser(user.id, options);
}

async function taskAccessWhereForUser(user, options = {}) {
  const packageIds = await activePackageIdsForUser(user, options);
  if (!packageIds.length) return { status: 'active', packageId: null };
  return { status: 'active', [Op.or]: [{ packageId: null }, { packageId: { [Op.in]: packageIds } }] };
}

async function userCanAccessTask(user, task, options = {}) {
  if (!task.packageId) return true;
  const packageIds = await activePackageIdsForUser(user, options);
  return packageIds.includes(task.packageId);
}

function taskRewardAmount(task) {
  const plan = task?.package;
  if (plan) return money(earningPerAdForPackage(plan));
  return FREE_AD_REWARD;
}

async function creditFreeDirectReferralOnce({ user, submission, taskDate, taskReward }, options = {}) {
  if (hasActivePackage(user) || !user?.referredById || taskReward <= 0) return null;
  const transaction = options.transaction;
  const existing = await Income.findOne({
    where: {
      userId: user.referredById,
      fromUserId: user.id,
      userTaskId: submission.id,
      type: 'referral',
      level: 1
    },
    transaction
  });
  if (existing) return existing;

  const amount = money((taskReward * FREE_DIRECT_REFERRAL_PERCENT) / 100);
  if (amount <= 0) return null;

  const result = await creditIncome({
    userId: user.referredById,
    amount,
    category: 'referral_income',
    referenceDate: taskDate,
    remarks: `Direct free ad referral income from ${user.name}`,
    incomePayload: {
      userId: user.referredById,
      fromUserId: user.id,
      userTaskId: submission.id,
      type: 'referral',
      level: 1,
      percentage: FREE_DIRECT_REFERRAL_PERCENT,
      amount,
      status: 'approved',
      remarks: `10% direct referral commission on free ad completed for ${taskDate}`
    }
  }, { transaction });

  await Notification.create({
    userId: user.referredById,
    title: 'Direct referral income credited',
    body: `You earned ${amount} from a direct free ad referral.`,
    type: 'income',
    data: { incomeId: result.income.id, fromUserId: user.id, userTaskId: submission.id }
  }, { transaction });

  return result.income;
}

async function creditTaskRewardOnce({ submission, task, taskDate, user }, options = {}) {
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
  if (!task?.packageId) {
    await creditFreeDirectReferralOnce({ user, submission, taskDate, taskReward: amount }, { transaction });
  }
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
  const packageIds = req.user.role === 'admin' ? [] : await activePackageIdsForUser(req.user);

  const now = new Date();
  const taskDate = todayKey();
  const where = req.user.role === 'admin'
    ? {}
    : packageIds.length
      ? { status: 'active', [Op.or]: [{ packageId: null }, { packageId: { [Op.in]: packageIds } }] }
      : { status: 'active', packageId: null };
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
    const seenLinks = new Set();
    const activePlan = req.user.packageId
      ? visibleTasks.find((task) => task.packageId === req.user.packageId)?.package
      : visibleTasks.find((task) => task.package)?.package;
    const paidLimit = packageIds.length ? Number(activePlan?.dailyAdsRequired || activePlan?.minAdsRequired || 20) : 0;
    let freeCount = 0;
    let paidCount = 0;
    visibleTasks = visibleTasks.filter((task) => {
      const linkKey = String(task.taskUrl || task.videoUrl || task.title || task.id).trim().toLowerCase();
      if (linkKey && seenLinks.has(linkKey)) return false;
      if (!task.packageId && freeCount >= FREE_AD_LIMIT) return false;
      if (task.packageId && paidCount >= paidLimit) return false;
      if (linkKey) seenLinks.add(linkKey);
      if (task.packageId) paidCount += 1;
      else freeCount += 1;
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

exports.postTodayTwenty = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.tasks) ? req.body.tasks : [];
  if (rows.length !== 20) throw new ApiError(400, 'Exactly 20 tasks are required');
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
  const payloads = rows.map((item, index) => {
    if (!item.taskUrl) throw new ApiError(400, `Task ${index + 1} URL is required`);
    return {
      title: item.title || `Today's Advertisement ${index + 1}`,
      platform: item.platform || 'youtube',
      taskUrl: item.taskUrl,
      description: item.description || 'Watch the complete advertisement to finish this task.',
      rewardAmount: Number(item.rewardAmount || 0),
      packageId: item.packageId || req.body.packageId || null,
      startsAt,
      endsAt,
      status: ['active', 'inactive', 'expired'].includes(item.status) ? item.status : 'active'
    };
  });
  const tasks = await Task.bulkCreate(payloads);
  res.status(201).json({ tasks, count: tasks.length, taskDate: startsAt.toISOString().slice(0, 10) });
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
      screenshot: uploadedFileUrl(req.file, 'tasks'),
      notes: req.body.notes || null,
      status: 'submitted'
    }
  });

  if (!created) {
    if (submission.status === 'approved') throw new ApiError(400, 'Task is already approved');
    await submission.update({
      screenshot: uploadedFileUrl(req.file, 'tasks') || submission.screenshot,
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
      await creditTaskRewardOnce({ submission, task, taskDate, user: req.user }, { transaction });
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
      taskDate: submission.taskDate,
      user: submission.user
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
