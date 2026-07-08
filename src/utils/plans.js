const PLAN_CONFIG = [
  {
    name: '₹999 Plan',
    oldName: '₹1,000 Plan',
    baseAmount: 999,
    taxAmount: 125,
    finalAmount: 1124,
    totalAdvertisements: 20,
    earningPerAdvertisement: 0.5,
    dailyWorkMinutes: 30,
    dailyDebitAmount: 10,
    freeBannerCount: 1
  },
  {
    name: '₹1,999 Plan',
    oldName: '₹2,000 Plan',
    baseAmount: 1999,
    taxAmount: 125,
    finalAmount: 2124,
    totalAdvertisements: 20,
    earningPerAdvertisement: 1,
    dailyWorkMinutes: 60,
    dailyDebitAmount: 20,
    freeBannerCount: 2
  },
  {
    name: '₹2,999 Plan',
    oldName: '₹3,000 Plan',
    baseAmount: 2999,
    taxAmount: 125,
    finalAmount: 3124,
    totalAdvertisements: 20,
    earningPerAdvertisement: 1.5,
    dailyWorkMinutes: 120,
    dailyDebitAmount: 30,
    freeBannerCount: 3
  }
];

function monthlyGenerationAmount(plan) {
  return Number((plan.totalAdvertisements * plan.earningPerAdvertisement * 30).toFixed(2));
}

function planDefaults(plan) {
  return {
    name: plan.name,
    baseAmount: plan.baseAmount,
    taxAmount: plan.taxAmount,
    finalAmount: plan.finalAmount,
    minAdsRequired: plan.totalAdvertisements,
    dailyAdsRequired: plan.totalAdvertisements,
    earningPerAdvertisement: plan.earningPerAdvertisement,
    dailyWorkMinutes: plan.dailyWorkMinutes,
    monthlyGenerationAmount: monthlyGenerationAmount(plan),
    dailyDebitAmount: plan.dailyDebitAmount,
    freeBannerCount: plan.freeBannerCount,
    status: 'active'
  };
}

function earningPerAdForPackage(pkg) {
  if (Number(pkg?.earningPerAdvertisement || 0) > 0) {
    return Number(Number(pkg.earningPerAdvertisement).toFixed(2));
  }
  const baseAmount = Number(pkg?.baseAmount || 0);
  const configured = PLAN_CONFIG.find((plan) => Number(plan.baseAmount) === baseAmount || plan.name === pkg?.name);
  if (configured) return configured.earningPerAdvertisement;
  if (Number(pkg?.dailyAdsRequired || 0)) {
    return Number((Number(pkg.monthlyGenerationAmount || 0) / 30 / Number(pkg.dailyAdsRequired || 1)).toFixed(2));
  }
  return 0.5;
}

module.exports = {
  PLAN_CONFIG,
  planDefaults,
  earningPerAdForPackage,
  monthlyGenerationAmount
};
