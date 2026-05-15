function makeReferralCode(seed = '') {
  const prefix = seed.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'ILLU';
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${suffix}`;
}

module.exports = { makeReferralCode };
