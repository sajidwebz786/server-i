const Joi = require('joi');

const id = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const amount = Joi.number().precision(2).positive();

exports.register = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().min(8).max(20).required(),
  password: Joi.string().min(6).max(128).required(),
  referralCode: Joi.string().allow('', null),
  packageId: id.allow(null)
});

exports.login = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required()
});

exports.otp = Joi.object({
  target: Joi.string().required(),
  channel: Joi.string().valid('mobile', 'email', 'whatsapp').default('mobile'),
  purpose: Joi.string().valid('register', 'login', 'reset_password').default('login')
});

exports.verifyOtp = exports.otp.keys({
  code: Joi.string().min(4).max(8).required()
});

exports.availability = Joi.object({
  email: Joi.string().email(),
  mobile: Joi.string().min(8).max(20)
}).or('email', 'mobile');

exports.package = Joi.object({
  name: Joi.string().min(2).max(120),
  description: Joi.string().allow('', null),
  baseAmount: Joi.number().precision(2).min(0),
  taxAmount: Joi.number().precision(2).min(0).default(0),
  finalAmount: Joi.number().precision(2).min(0),
  minAdsRequired: Joi.number().integer().min(0),
  freeBannerCount: Joi.number().integer().min(0),
  status: Joi.string().valid('active', 'inactive')
}).min(1);

exports.createPackage = exports.package.fork(['name', 'baseAmount', 'finalAmount'], (schema) => schema.required());

exports.packageStatus = Joi.object({
  status: Joi.string().valid('active', 'inactive').required()
});

exports.incomeSettings = Joi.object({
  settings: Joi.array().items(Joi.object({
    level: Joi.number().integer().min(1).required(),
    percentage: Joi.number().precision(2).min(0).max(100).required(),
    status: Joi.string().valid('active', 'inactive')
  })).min(1).required()
});

exports.payment = Joi.object({
  packageId: id.required(),
  paymentMode: Joi.string().valid('gateway', 'upi', 'manual', 'cash').default('manual'),
  utrNumber: Joi.string().allow('', null)
});

exports.adminRemarks = Joi.object({
  adminRemarks: Joi.string().allow('', null)
});

exports.task = Joi.object({
  title: Joi.string().min(2).max(160),
  platform: Joi.string().valid('youtube', 'instagram', 'facebook', 'google', 'website', 'whatsapp', 'banner', 'local', 'other'),
  taskUrl: Joi.string().uri().allow('', null),
  description: Joi.string(),
  rewardAmount: Joi.number().precision(2).min(0),
  packageId: id.allow(null),
  startsAt: Joi.date().allow(null),
  endsAt: Joi.date().allow(null),
  status: Joi.string().valid('active', 'inactive', 'expired')
}).min(1);

exports.createTask = exports.task.fork(['title', 'platform', 'description'], (schema) => schema.required());

exports.taskSubmit = Joi.object({
  notes: Joi.string().allow('', null)
});

exports.taskApproval = Joi.object({
  adminRemarks: Joi.string().allow('', null),
  rewardAmount: Joi.number().precision(2).min(0)
});

exports.bank = Joi.object({
  bankName: Joi.string().allow('', null),
  accountHolderName: Joi.string().allow('', null),
  accountNumber: Joi.string().allow('', null),
  ifscCode: Joi.string().allow('', null),
  upiId: Joi.string().allow('', null),
  panNumber: Joi.string().allow('', null)
}).or('accountNumber', 'upiId');

exports.withdrawal = Joi.object({
  amount: amount.required()
});

exports.ticket = Joi.object({
  subject: Joi.string().min(3).max(160).required(),
  message: Joi.string().min(3).required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium')
});

exports.reply = Joi.object({
  message: Joi.string().min(1).required()
});

exports.updateUser = Joi.object({
  name: Joi.string().min(2).max(120),
  email: Joi.string().email(),
  mobile: Joi.string().min(8).max(20),
  status: Joi.string().valid('pending', 'active', 'inactive', 'blocked'),
  packageId: id.allow(null),
  isMobileVerified: Joi.boolean(),
  isEmailVerified: Joi.boolean()
}).min(1);

exports.resetPassword = Joi.object({
  password: Joi.string().min(6).max(128).required()
});

exports.profile = Joi.object({
  name: Joi.string().min(2).max(120),
  email: Joi.string().email(),
  mobile: Joi.string().min(8).max(20)
}).min(1);

exports.changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(128).required()
});

exports.banner = Joi.object({
  title: Joi.string().min(2).max(160).required(),
  imageUrl: Joi.string().allow('', null),
  linkUrl: Joi.string().uri().allow('', null),
  placement: Joi.string().valid('home', 'dashboard', 'promotion', 'mobile').default('home'),
  status: Joi.string().valid('active', 'inactive').default('active')
});

exports.bannerUpdate = Joi.object({
  title: Joi.string().min(2).max(160),
  imageUrl: Joi.string().allow('', null),
  linkUrl: Joi.string().uri().allow('', null),
  placement: Joi.string().valid('home', 'dashboard', 'promotion', 'mobile'),
  status: Joi.string().valid('active', 'inactive')
}).min(1);

exports.notification = Joi.object({
  userId: id.allow(null),
  title: Joi.string().min(2).max(160).required(),
  body: Joi.string().min(1).required(),
  type: Joi.string().valid('task', 'payment', 'withdrawal', 'income', 'support', 'general').default('general'),
  data: Joi.object().allow(null)
});
