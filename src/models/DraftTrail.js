const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DraftTrail = sequelize.define('DraftTrail', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referenceCode: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
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
      get() {
        const value = this.getDataValue('headerVideos');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('headerVideos', JSON.stringify(value || []));
      },
    },
    status: {
      type: DataTypes.ENUM('draft', 'payment_pending', 'payment_completed', 'payment_failed', 'expired', 'submitted', 'completed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName: 'draft_trails',
    timestamps: true,
    underscored: true,
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
      { fields: ['expiresAt'] },
      { fields: ['publishedAt'] },
    ],
  });

  DraftTrail.associate = (models) => {
    DraftTrail.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    DraftTrail.hasMany(models.CustomStory, {
      foreignKey: 'referenceCode',
      sourceKey: 'referenceCode',
      as: 'customStories',
    });
    DraftTrail.hasMany(models.File, {
      foreignKey: 'referenceCode',
      sourceKey: 'referenceCode',
      as: 'files',
    });
    DraftTrail.hasMany(models.Payment, {
      foreignKey: 'referenceCode',
      sourceKey: 'referenceCode',
      as: 'payments',
    });
  };

  return DraftTrail;
};
