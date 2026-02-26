/**
 * MySQL Connection Pool with Lambda support
 * Uses pooling to reuse connections across Lambda invocations
 */

const mysql = require('mysql2/promise');

let pool = null;

const initializePool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'yesterday_stories',
      waitForConnections: true,
      connectionLimit: 5, // Lower limit for Lambda
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0,
      timezone: 'Z', // UTC timezone
    });
  }
  return pool;
};

const getConnection = async () => {
  const pool = initializePool();
  return pool.getConnection();
};

const query = async (sql, values = []) => {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(sql, values);
    return results;
  } finally {
    connection.release();
  }
};

// Initialize SQL setup script
const initializeDatabase = async () => {
  const connection = await getConnection();
  try {
    // Create trails table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS trails (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referenceCode VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT,
        difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Easy',
        distance DECIMAL(10, 2) DEFAULT 0,
        headerImages LONGTEXT,
        headerVideos LONGTEXT,
        status ENUM('payment_pending', 'payment_completed', 'payment_failed') DEFAULT 'payment_pending',
        isPaid BOOLEAN DEFAULT FALSE,
        isDeleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        publishedAt TIMESTAMP NULL,
        INDEX idx_referenceCode (referenceCode),
        INDEX idx_userId (userId),
        INDEX idx_status (status),
        INDEX idx_isPaid (isPaid),
        INDEX idx_createdAt (createdAt),
        INDEX idx_publishedAt (publishedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    // Create custom_stories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS custom_stories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referenceCode VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        title VARCHAR(255),
        description LONGTEXT,
        category VARCHAR(100),
        categoryId INT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        imageUrl VARCHAR(1000),
        videoUrl VARCHAR(1000),
        orderIndex INT,
        isPublished BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (referenceCode) REFERENCES trails(referenceCode) ON DELETE CASCADE,
        INDEX idx_referenceCode (referenceCode),
        INDEX idx_orderIndex (orderIndex),
        INDEX idx_categoryId (categoryId),
        INDEX idx_isPublished (isPublished)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('✅ Database tables initialized');
  } finally {
    connection.release();
  }
};

module.exports = {
  initializePool,
  getConnection,
  query,
  initializeDatabase,
};
