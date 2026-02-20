/**
 * Models Index - Initialize all Sequelize models and associations
 * Note: Firebase Auth handles users - no User table needed
 * Note: Files are stored as URLs in trails and customStories - no File table needed
 */

const { getSequelize } = require('../db/sequelize');

// Import model definitions
const TrailModel = require('./Trail');
const CustomStoryModel = require('./CustomStory');
const PaymentModel = require('./Payment');

let models = null;

const initializeModels = () => {
  if (models) {
    return models;
  }

  const sequelize = getSequelize();

  // Initialize all models
  models = {
    Trail: TrailModel(sequelize),
    CustomStory: CustomStoryModel(sequelize),
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
