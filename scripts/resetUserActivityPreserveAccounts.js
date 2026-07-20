const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Payment,
  Referral,
  Income,
  Wallet,
  Transaction,
  UserTask,
  BankDetail,
  Withdrawal,
  SupportTicket,
  SupportReply,
  Otp,
  Notification
} = require('../src/models');

async function counts() {
  const [admins, users, payments, referrals, incomes, transactions, submissions, withdrawals, tickets, notifications] = await Promise.all([
    User.count({ where: { role: 'admin' } }),
    User.count({ where: { role: 'user' } }),
    Payment.count(),
    Referral.count(),
    Income.count(),
    Transaction.count(),
    UserTask.count(),
    Withdrawal.count(),
    SupportTicket.count(),
    Notification.count()
  ]);
  return { admins, users, payments, referrals, incomes, transactions, submissions, withdrawals, tickets, notifications };
}

async function reset() {
  await sequelize.authenticate();
  const before = await counts();

  await sequelize.transaction(async (transaction) => {
    await Transaction.destroy({ where: {}, transaction });
    await Income.destroy({ where: {}, transaction });
    await UserTask.destroy({ where: {}, transaction });
    await Withdrawal.destroy({ where: {}, transaction });
    await Payment.destroy({ where: {}, transaction });
    await SupportReply.destroy({ where: {}, transaction });
    await SupportTicket.destroy({ where: {}, transaction });
    await Notification.destroy({ where: {}, transaction });
    await Otp.destroy({ where: {}, transaction });
    await BankDetail.destroy({ where: {}, transaction });
    await Referral.destroy({ where: {}, transaction });

    await User.update(
      { packageId: null, status: 'active' },
      { where: { role: 'user' }, transaction }
    );

    await Wallet.update({
      totalEarned: 0,
      availableBalance: 0,
      withdrawnAmount: 0,
      pendingWithdrawal: 0
    }, { where: {}, transaction });

    const usersWithoutWallets = await User.findAll({
      attributes: ['id'],
      include: [{ model: Wallet, as: 'wallet', required: false, attributes: ['id'] }],
      transaction
    });
    const missingWallets = usersWithoutWallets
      .filter((user) => !user.wallet)
      .map((user) => ({ userId: user.id }));
    if (missingWallets.length) await Wallet.bulkCreate(missingWallets, { transaction });

    const sponsoredUsers = await User.findAll({
      where: { role: 'user', referredById: { [Op.ne]: null } },
      attributes: ['id', 'referredById'],
      transaction
    });
    if (sponsoredUsers.length) {
      await Referral.bulkCreate(sponsoredUsers.map((user) => ({
        parentUserId: user.referredById,
        childUserId: user.id,
        level: 1,
        packageId: null
      })), { transaction, ignoreDuplicates: true });
    }
  });

  const after = await counts();
  const paidUsers = await User.count({ where: { role: 'user', packageId: { [Op.ne]: null } } });
  const nonZeroWallets = await Wallet.count({
    where: {
      [Op.or]: [
        { totalEarned: { [Op.ne]: 0 } },
        { availableBalance: { [Op.ne]: 0 } },
        { withdrawnAmount: { [Op.ne]: 0 } },
        { pendingWithdrawal: { [Op.ne]: 0 } }
      ]
    }
  });

  console.log(JSON.stringify({ before, after, verification: { paidUsers, nonZeroWallets } }, null, 2));
}

reset()
  .catch((error) => {
    console.error('Credential-preserving reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
