const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const { env } = require('./config/env');
const swaggerSpec = require('./config/swagger');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const defaultAllowedOrigins = [
  'https://www.luminateads.com',
  'https://luminateads.com',
  'https://client-i.onrender.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost',
  'http://192.168.1.2'
];

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [...new Set([...(env.clientUrls || []), ...defaultAllowedOrigins])];
    const normalizedOrigin = origin ? origin.replace(/\/+$|\s+/g, '') : origin;
    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'luminateads-api' });
});

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'Luminate Ads API Docs'
}));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
