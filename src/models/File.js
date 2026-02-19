const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const File = sequelize.define('File', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referenceCode: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'referenceCode',
      references: {
        model: 'trails',
        key: 'referenceCode',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    fileType: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: false,
    },
    s3Key: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    s3Url: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'files',
    timestamps: true,
    underscored: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['user_id'] },
      { fields: ['file_type'] },
      { fields: ['created_at'] },
    ],
  });

  File.associate = (models) => {
    File.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    File.belongsTo(models.Trail, {
      foreignKey: 'referenceCode',
      targetKey: 'referenceCode',
      as: 'trail',
    });
  };

  return File;
};
