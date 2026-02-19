/**
 * Sequelize Database Connection
 * Replaces raw MySQL pool with ORM
 */

const { Sequelize } = require('sequelize');

let sequelize = null;

const initializeSequelize = () => {
  if (!sequelize) {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'yesterday_stories',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        timezone: '+00:00', // UTC
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        define: {
          charset: 'utf8mb4',
          collate: 'utf8mb4_general_ci',
          underscored: true,
          timestamps: true,
        },
      }
    );
  }
  return sequelize;
};

const getSequelize = () => {
  if (!sequelize) {
    return initializeSequelize();
  }
  return sequelize;
};

module.exports = {
  initializeSequelize,
  getSequelize,
};
