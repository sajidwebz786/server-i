const { Op } = require('sequelize');
const sequelize = require('../src/config/database');
const { env } = require('../src/config/env');
const { User } = require('../src/models');

async function main() {
  if (!env.dbHost || env.dbHost === 'localhost') {
    console.log('Refusing to run: DB_HOST is not set to a remote database.');
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  const admin = await User.findOne({ where: { role: 'admin', email: env.adminEmail } })
    || await User.findOne({ where: { role: 'admin' } });

  if (!admin) {
    console.log('No admin account found. Please seed or create admin first.');
    process.exitCode = 1;
    return;
  }

  const [updated] = await User.update(
    { referredById: admin.id },
    {
      where: {
        role: 'user',
        referredById: { [Op.is]: null },
        id: { [Op.ne]: admin.id }
      }
    }
  );

  const remaining = await User.count({
    where: {
      role: 'user',
      referredById: { [Op.is]: null }
    }
  });

  console.log('Admin referral backfill complete.', {
    adminEmail: admin.email,
    adminReferralCode: admin.referralCode,
    updated,
    remainingUnassignedUsers: remaining
  });
}

main()
  .catch((error) => {
    console.error('Admin referral backfill failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
