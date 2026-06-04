const { Package, IncomeSetting, sequelize } = require('../src/models');

const commissionLevels = [
  { level: 1, percentage: 10 },
  { level: 2, percentage: 5 },
  { level: 3, percentage: 3 },
  { level: 4, percentage: 1 },
  { level: 5, percentage: 1 },
  { level: 6, percentage: 0.5 },
  { level: 7, percentage: 0.5 },
  { level: 8, percentage: 0.25 },
  { level: 9, percentage: 0.25 },
  { level: 10, percentage: 0.25 }
];

async function applyCommissionStructure() {
  const packages = await Package.findAll({
    where: { name: ['₹999 Plan', '₹1,999 Plan', '₹2,999 Plan'] }
  });

  for (const pkg of packages) {
    for (const item of commissionLevels) {
      const [setting] = await IncomeSetting.findOrCreate({
        where: { packageId: pkg.id, level: item.level },
        defaults: { packageId: pkg.id, ...item, status: 'active' }
      });
      await setting.update({ percentage: item.percentage, status: 'active' });
    }
  }

  console.log('Commission structure updated.', {
    packages: packages.map((pkg) => pkg.name),
    levels: commissionLevels
  });
}

applyCommissionStructure()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
