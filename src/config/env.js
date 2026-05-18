require('dotenv').config();

function normalizeOrigin(url) {
  return url.replace(/\/+$/, '');
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || '*',
  clientUrls: (process.env.CLIENT_URL || '*').split(',').map((url) => normalizeOrigin(url.trim())).filter(Boolean),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 5432),
  dbName: process.env.DB_NAME || 'luminateadsdb',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || '',
  dbDialect: process.env.DB_DIALECT || 'postgres',
  dbSsl: String(process.env.DB_SSL || process.env.NODE_ENV === 'production').toLowerCase() === 'true',
  dbSyncAlter: String(process.env.DB_SYNC_ALTER || 'false') === 'true',
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@luminateads.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpBypassCode: process.env.OTP_BYPASS_CODE || '',
  uploadBaseUrl: process.env.UPLOAD_BASE_URL || 'http://localhost:5000/uploads'
};

module.exports = { env };
