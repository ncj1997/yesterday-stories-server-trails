const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trail = sequelize.define('Trail', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referenceCode: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'referenceCode',
    },
    userId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'userId',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    difficulty: {
      type: DataTypes.ENUM('Easy', 'Medium', 'Hard'),
      allowNull: false,
      defaultValue: 'Easy',
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    headerImages: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'headerImages',
      get() {
        const value = this.getDataValue('headerImages');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('headerImages', JSON.stringify(value || []));
      },
    },
    headerVideos: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'headerVideos',
      get() {
        const value = this.getDataValue('headerVideos');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('headerVideos', JSON.stringify(value || []));
      },
    },
    status: {
      type: DataTypes.ENUM('payment_pending', 'payment_completed', 'payment_failed'),
      allowNull: false,
      defaultValue: 'payment_pending',
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'isPaid',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'isDeleted',
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'publishedAt',
    },
  }, {
    tableName: 'trails',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['isPaid'] },
      { fields: ['difficulty'] },
      { fields: ['distance'] },
      { fields: ['createdAt'] },
      { fields: ['publishedAt'] },
    ],
  });

  Trail.associate = (models) => {
    Trail.hasMany(models.CustomStory, {
      foreignKey: 'referenceCode',
      sourceKey: 'referenceCode',
      as: 'customStories',
    });
  };

  return Trail;
};
