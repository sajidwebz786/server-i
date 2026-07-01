const { env } = require('../config/env');

function publicFileUrl(pathValue) {
  if (!pathValue) return null;
  if (/^https?:\/\//i.test(pathValue)) return pathValue;
  const cleanPath = String(pathValue).replace(/^\/+/, '');
  if (cleanPath.startsWith('uploads/')) {
    return `${env.uploadBaseUrl.replace(/\/uploads\/?$/, '')}/${cleanPath}`;
  }
  return `${env.uploadBaseUrl.replace(/\/+$/, '')}/${cleanPath}`;
}

function withPaymentProof(payment) {
  const plain = payment?.toJSON ? payment.toJSON() : payment;
  if (!plain) return plain;
  return {
    ...plain,
    proofUrl: publicFileUrl(plain.screenshot),
    proofDownloadUrl: publicFileUrl(plain.screenshot),
    proofType: plain.screenshot && String(plain.screenshot).toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
  };
}

module.exports = { publicFileUrl, withPaymentProof };
