const sequelize = require('../src/config/database');
const { Op, fn, col, where } = require('sequelize');
const { env } = require('../src/config/env');
const { User, Notification } = require('../src/models');

async function main() {
  if (!env.dbHost || env.dbHost === 'localhost') {
    console.log('Refusing to run: DB_HOST is not set to a remote database.');
    console.log('Set DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/DB_SSL in server/.env, then run again.');
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const dateKey = targetDate.toISOString().split('T')[0];

  const users = await User.findAll({
    where: where(fn('date', col('subscriptionExpiresAt')), dateKey),
    attributes: ['id', 'name', 'subscriptionExpiresAt']
  });

  if (!users.length) {
    console.log(`No users found with subscription expiring on ${dateKey}.`);
    return;
  }

  let remindersSent = 0;
  for (const user of users) {
    const existing = await Notification.findOne({
      where: {
        userId: user.id,
        type: 'renewal',
        data: { expiryDate: dateKey }
      }
    });

    if (existing) continue;

    await Notification.create({
      userId: user.id,
      title: 'Subscription renewal due soon',
      body: `Your package subscription will expire on ${dateKey}. Please renew within the next 7 days to avoid interruption.`,
      type: 'renewal',
      data: { expiryDate: dateKey }
    });

    remindersSent += 1;
  }

  console.log(`Renewal reminder job complete. Sent ${remindersSent} notification(s) for ${dateKey}.`);
}

main()
  .catch((error) => {
    console.error('Renewal reminder job failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
