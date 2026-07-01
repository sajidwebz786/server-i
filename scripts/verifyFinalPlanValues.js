const { sequelize, Package } = require('../src/models');
const { earningPerAdForPackage } = require('../src/utils/plans');

async function main() {
  await sequelize.authenticate();
  const packages = await Package.findAll({
    where: { name: ['₹999 Plan', '₹1,999 Plan', '₹2,999 Plan'] },
    order: [['baseAmount', 'ASC']]
  });

  console.log(JSON.stringify(packages.map((pkg) => ({
    name: pkg.name,
    baseAmount: Number(pkg.baseAmount),
    finalAmount: Number(pkg.finalAmount),
    totalAdvertisements: Number(pkg.dailyAdsRequired || pkg.minAdsRequired || 0),
    earningPerAdvertisement: earningPerAdForPackage(pkg),
    status: pkg.status
  })), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
