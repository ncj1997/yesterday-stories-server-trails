/**
 * Database Initialization Script
 * Run this to sync all Sequelize models with database
 */

require('dotenv').config();
const { syncDatabase, getModels } = require('../models');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database with Sequelize...');
    
    // Initialize models
    getModels();
    
    // Sync database (create tables if they don't exist)
    // Use { alter: true } to update existing tables
    // Use { force: true } to drop and recreate (WARNING: deletes data!)
    await syncDatabase({ alter: true });
    
    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
