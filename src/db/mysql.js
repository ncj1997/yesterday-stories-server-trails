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
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create draft_trails table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS draft_trails (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referenceCode VARCHAR(100) NOT NULL UNIQUE,
        userId INT NOT NULL,
        trailData LONGTEXT NOT NULL,
        status ENUM('draft', 'submitted', 'completed', 'expired') DEFAULT 'draft',
        isPaid BOOLEAN DEFAULT FALSE,
        isDeleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiresAt TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_referenceCode (referenceCode),
        INDEX idx_userId (userId),
        INDEX idx_status (status),
        INDEX idx_isPaid (isPaid),
        INDEX idx_createdAt (createdAt),
        INDEX idx_expiresAt (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create files table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referenceCode VARCHAR(100) NOT NULL,
        userId INT NOT NULL,
        fileType ENUM('image', 'video') NOT NULL,
        s3Key VARCHAR(500) NOT NULL,
        s3Url VARCHAR(1000) NOT NULL,
        mimeType VARCHAR(100),
        fileSize BIGINT,
        metadata JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referenceCode) REFERENCES draft_trails(referenceCode) ON DELETE CASCADE,
        INDEX idx_referenceCode (referenceCode),
        INDEX idx_userId (userId),
        INDEX idx_fileType (fileType),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create tokens table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        token VARCHAR(500) NOT NULL UNIQUE,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_expiresAt (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
