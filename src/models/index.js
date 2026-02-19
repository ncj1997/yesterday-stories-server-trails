/**
 * Models Index - Initialize all Sequelize models and associations
 */

const { getSequelize } = require('../db/sequelize');

// Import model definitions
const UserModel = require('./User');
const TrailModel = require('./Trail');
const CustomStoryModel = require('./CustomStory');
const FileModel = require('./File');
const TokenModel = require('./Token');
const PaymentModel = require('./Payment');

let models = null;

const initializeModels = () => {
  if (models) {
    return models;
  }

  const sequelize = getSequelize();

  // Initialize all models
  models = {
    User: UserModel(sequelize),
    Trail: TrailModel(sequelize),
    CustomStory: CustomStoryModel(sequelize),
    File: FileModel(sequelize),
    Token: TokenModel(sequelize),
    Payment: PaymentModel(sequelize),
  };

  // Set up associations
  Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });

  models.sequelize = sequelize;

  return models;
};

const getModels = () => {
  if (!models) {
    return initializeModels();
  }
  return models;
};

const syncDatabase = async (options = {}) => {
  const { sequelize } = getModels();
  await sequelize.sync(options);
  console.log('✅ Database synchronized with Sequelize models');
};

module.exports = {
  initializeModels,
  getModels,
  syncDatabase,
};
