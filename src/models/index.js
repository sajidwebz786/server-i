const sequelize = require('../config/database');

const User = require('./user.model');
const Package = require('./package.model');
const Payment = require('./payment.model');
const Referral = require('./referral.model');
const IncomeSetting = require('./incomeSetting.model');
const Income = require('./income.model');
const Wallet = require('./wallet.model');
const Transaction = require('./transaction.model');
const Task = require('./task.model');
const UserTask = require('./userTask.model');
const BankDetail = require('./bankDetail.model');
const Withdrawal = require('./withdrawal.model');
const SupportTicket = require('./supportTicket.model');
const SupportReply = require('./supportReply.model');
const Otp = require('./otp.model');
const Banner = require('./banner.model');
const Notification = require('./notification.model');

User.belongsTo(User, { as: 'sponsor', foreignKey: 'referredById' });
User.hasMany(User, { as: 'directReferrals', foreignKey: 'referredById' });
User.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });
Package.hasMany(User, { as: 'users', foreignKey: 'packageId' });

User.hasOne(Wallet, { as: 'wallet', foreignKey: 'userId' });
Wallet.belongsTo(User, { as: 'user', foreignKey: 'userId' });

User.hasOne(BankDetail, { as: 'bankDetail', foreignKey: 'userId' });
BankDetail.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Payment.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Payment.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });
Payment.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
User.hasMany(Payment, { as: 'payments', foreignKey: 'userId' });

Referral.belongsTo(User, { as: 'parent', foreignKey: 'parentUserId' });
Referral.belongsTo(User, { as: 'child', foreignKey: 'childUserId' });
Referral.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });

IncomeSetting.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });
Package.hasMany(IncomeSetting, { as: 'incomeSettings', foreignKey: 'packageId' });

Income.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Income.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId' });
Income.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });
Income.belongsTo(Payment, { as: 'payment', foreignKey: 'paymentId' });
Income.belongsTo(UserTask, { as: 'userTask', foreignKey: 'userTaskId' });
User.hasMany(Income, { as: 'incomes', foreignKey: 'userId' });

Transaction.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Transaction.belongsTo(Wallet, { as: 'wallet', foreignKey: 'walletId' });
Transaction.belongsTo(Income, { as: 'income', foreignKey: 'incomeId' });
Transaction.belongsTo(Withdrawal, { as: 'withdrawal', foreignKey: 'withdrawalId' });

Task.belongsTo(Package, { as: 'package', foreignKey: 'packageId' });
Task.hasMany(UserTask, { as: 'submissions', foreignKey: 'taskId' });
UserTask.belongsTo(Task, { as: 'task', foreignKey: 'taskId' });
UserTask.belongsTo(User, { as: 'user', foreignKey: 'userId' });
UserTask.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
User.hasMany(UserTask, { as: 'taskSubmissions', foreignKey: 'userId' });

Withdrawal.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Withdrawal.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
User.hasMany(Withdrawal, { as: 'withdrawals', foreignKey: 'userId' });

SupportTicket.belongsTo(User, { as: 'user', foreignKey: 'userId' });
SupportTicket.hasMany(SupportReply, { as: 'replies', foreignKey: 'ticketId' });
SupportReply.belongsTo(SupportTicket, { as: 'ticket', foreignKey: 'ticketId' });
SupportReply.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Otp.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Package,
  Payment,
  Referral,
  IncomeSetting,
  Income,
  Wallet,
  Transaction,
  Task,
  UserTask,
  BankDetail,
  Withdrawal,
  SupportTicket,
  SupportReply,
  Otp,
  Banner,
  Notification
};
