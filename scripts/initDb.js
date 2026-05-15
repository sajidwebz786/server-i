const { sequelize } = require('../src/models');
const { seedDefaults } = require('../src/services/seed.service');

async function init() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await seedDefaults();
    console.log('Database synced and default data seeded.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

init();
