const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Luminateads Promotion Platform API',
      version: '1.0.0',
      description: 'Backend APIs for the Luminateads advertising, referral hierarchy, task, wallet, withdrawal, and admin platform.'
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server'
      }
    ],
    tags: [
      { name: 'Public', description: 'Public website and mobile app bootstrap APIs' },
      { name: 'Auth', description: 'Registration, login, OTP, and profile APIs' },
      { name: 'Packages', description: 'Package and income setting APIs' },
      { name: 'Payments', description: 'Package payment and proof approval APIs' },
      { name: 'Referrals', description: 'Referral tree, downline, and income APIs' },
      { name: 'Tasks', description: 'Promotion task and screenshot verification APIs' },
      { name: 'Wallet', description: 'Wallet, transactions, and bank details APIs' },
      { name: 'Withdrawals', description: 'Withdrawal request and admin payout APIs' },
      { name: 'Support', description: 'Support ticket APIs' },
      { name: 'Admin', description: 'Admin dashboard, user, report, banner, and notification APIs' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            details: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'mobile', 'password'],
          properties: {
            name: { type: 'string', example: 'Rahul Sharma' },
            email: { type: 'string', format: 'email', example: 'rahul@example.com' },
            mobile: { type: 'string', example: '9876543210' },
            password: { type: 'string', example: 'Password@123' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['identifier', 'password'],
          properties: {
            identifier: { type: 'string', example: 'rahul@example.com' },
            password: { type: 'string', example: 'Password@123' }
          }
        },
        OtpRequest: {
          type: 'object',
          required: ['target'],
          properties: {
            target: { type: 'string', example: '9876543210' },
            channel: { type: 'string', enum: ['mobile', 'email', 'whatsapp'], example: 'mobile' },
            purpose: { type: 'string', enum: ['register', 'login', 'reset_password'], example: 'login' }
          }
        },
        VerifyOtpRequest: {
          allOf: [
            { $ref: '#/components/schemas/OtpRequest' },
            {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', example: '123456' }
              }
            }
          ]
        },
        PackageRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: '1K Package' },
            description: { type: 'string', nullable: true },
            baseAmount: { type: 'number', example: 999 },
            taxAmount: { type: 'number', example: 125 },
            finalAmount: { type: 'number', example: 1124 },
            minAdsRequired: { type: 'integer', example: 0 },
            freeBannerCount: { type: 'integer', example: 0 },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' }
          }
        },
        PaymentRequest: {
          type: 'object',
          required: ['packageId'],
          properties: {
            packageId: { type: 'string', format: 'uuid' },
            paymentMode: { type: 'string', enum: ['gateway', 'upi', 'manual', 'cash'], example: 'manual' },
            utrNumber: { type: 'string', nullable: true, example: 'UTR123456789' },
            screenshot: { type: 'string', format: 'binary' }
          }
        },
        TaskRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Watch YouTube Promotion' },
            platform: { type: 'string', enum: ['youtube', 'instagram', 'facebook', 'google', 'website', 'whatsapp', 'banner', 'local', 'other'] },
            taskUrl: { type: 'string', nullable: true, example: 'https://youtube.com/watch?v=example' },
            description: { type: 'string', example: 'Watch, like, and upload screenshot proof.' },
            rewardAmount: { type: 'number', example: 10 },
            packageId: { type: 'string', format: 'uuid', nullable: true },
            startsAt: { type: 'string', format: 'date-time', nullable: true },
            endsAt: { type: 'string', format: 'date-time', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive', 'expired'] }
          }
        },
        BankDetailRequest: {
          type: 'object',
          properties: {
            bankName: { type: 'string', example: 'HDFC Bank' },
            accountHolderName: { type: 'string', example: 'Rahul Sharma' },
            accountNumber: { type: 'string', example: '123456789012' },
            ifscCode: { type: 'string', example: 'HDFC0001234' },
            upiId: { type: 'string', example: 'rahul@upi' },
            panNumber: { type: 'string', example: 'ABCDE1234F' }
          }
        },
        WithdrawalRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', example: 500 }
          }
        },
        SupportTicketRequest: {
          type: 'object',
          required: ['subject', 'message'],
          properties: {
            subject: { type: 'string', example: 'Payment approval pending' },
            message: { type: 'string', example: 'I uploaded my UTR yesterday.' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'medium' }
          }
        },
        AdminRemarksRequest: {
          type: 'object',
          properties: {
            adminRemarks: { type: 'string', example: 'Verified successfully.' }
          }
        },
        BannerRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Festival Promotion' },
            image: { type: 'string', format: 'binary' },
            imageUrl: { type: 'string', nullable: true },
            linkUrl: { type: 'string', nullable: true },
            placement: { type: 'string', enum: ['home', 'dashboard', 'promotion', 'mobile'], example: 'home' },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' }
          }
        },
        NotificationRequest: {
          type: 'object',
          required: ['title', 'body'],
          properties: {
            userId: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string', example: 'New task available' },
            body: { type: 'string', example: 'Complete today’s promotion task.' },
            type: { type: 'string', enum: ['task', 'payment', 'withdrawal', 'income', 'support', 'general'], example: 'task' },
            data: { type: 'object', nullable: true }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication token missing or invalid',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        },
        Forbidden: {
          description: 'Role does not have permission',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        },
        ValidationError: {
          description: 'Validation failed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
