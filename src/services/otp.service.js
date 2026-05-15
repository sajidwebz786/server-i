const { Otp } = require('../models');
const { env } = require('../config/env');

function generateOtp() {
  if (env.otpBypassCode) return env.otpBypassCode;
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createOtp({ userId, channel, target, purpose }) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);

  const otp = await Otp.create({ userId, channel, target, purpose, code, expiresAt });

  // Replace this stub with SMS, WhatsApp, or email provider integration.
  console.log(`OTP for ${target}: ${code}`);
  return otp;
}

async function verifyOtp({ target, code, purpose }) {
  const otp = await Otp.findOne({
    where: { target, code, purpose, verifiedAt: null },
    order: [['createdAt', 'DESC']]
  });

  if (!otp || otp.expiresAt < new Date()) return null;

  await otp.update({ verifiedAt: new Date() });
  return otp;
}

module.exports = { createOtp, verifyOtp };
