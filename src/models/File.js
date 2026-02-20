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
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'userId',
    },
    fileType: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: false,
      field: 'fileType',
    },
    s3Key: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 's3Key',
    },
    s3Url: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      field: 's3Url',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'mimeType',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'fileSize',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'metadata',
    },
  }, {
    tableName: 'files',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['userId'] },
      { fields: ['fileType'] },
      { fields: ['createdAt'] },
    ],
  });

  File.associate = (models) => {
    File.belongsTo(models.Trail, {
      foreignKey: 'referenceCode',
      targetKey: 'referenceCode',
      as: 'trail',
    });
  };

  return File;
};
