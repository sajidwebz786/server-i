const app = require('./src/app');
const { sequelize } = require('./src/models');
const { env } = require('./src/config/env');
const { seedDefaults } = require('./src/services/seed.service');

async function start() {
  try {
    await sequelize.authenticate();

    if (env.dbSyncAlter) {
      await sequelize.sync({ alter: true });
      await seedDefaults();
    }

    app.listen(env.port, () => {
      console.log(`Illuminate API running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Unable to start Illuminate API:', error);
    process.exit(1);
  }
}

start();
