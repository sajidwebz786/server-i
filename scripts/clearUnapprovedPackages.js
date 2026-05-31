const { Op } = require('sequelize');
const sequelize = require('../src/config/database');
const { env } = require('../src/config/env');
const { User, Payment } = require('../src/models');

async function main() {
  if (!env.dbHost || env.dbHost === 'localhost') {
    console.log('Refusing to run: DB_HOST is not set to a remote database.');
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  const users = await User.findAll({
    where: {
      role: 'user',
      packageId: { [Op.ne]: null }
    }
  });

  let cleared = 0;

  for (const user of users) {
    const approvedPayment = await Payment.findOne({
      where: {
        userId: user.id,
        packageId: user.packageId,
        status: 'approved'
      }
    });

    if (!approvedPayment) {
      await user.update({ packageId: null, status: 'pending' });
      cleared += 1;
    }
  }

  console.log('Unapproved package cleanup complete.', { checked: users.length, cleared });
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
