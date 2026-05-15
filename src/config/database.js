const { Sequelize } = require('sequelize');
const { env } = require('./env');

const sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: env.dbDialect,
  dialectOptions: env.dbSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : {},
  logging: env.nodeEnv === 'development' ? false : false,
  define: {
    underscored: true,
    timestamps: true
  }
});

module.exports = sequelize;
