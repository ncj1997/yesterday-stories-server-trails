const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CustomStory = sequelize.define('CustomStory', {
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'categoryId',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    videoUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'orderIndex',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'isPublished',
    },
  }, {
    tableName: 'custom_stories',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['orderIndex'] },
      { fields: ['categoryId'] },
      { fields: ['isPublished'] },
    ],
  });

  CustomStory.associate = (models) => {
    CustomStory.belongsTo(models.Trail, {
      foreignKey: 'referenceCode',
      targetKey: 'referenceCode',
      as: 'trail',
    });
  };

  return CustomStory;
};
