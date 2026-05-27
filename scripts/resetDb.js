const { sequelize } = require('../src/models');
const { seedDefaults } = require('../src/services/seed.service');

async function reset() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    await seedDefaults();
    console.log('Database reset complete. Default data seeded.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

reset();
