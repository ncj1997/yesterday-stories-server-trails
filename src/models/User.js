const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    userId: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
      field: 'userId',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['email'] },
    ],
  });

  User.associate = (models) => {
    User.hasMany(models.Trail, {
      foreignKey: 'userId',
      as: 'trails',
    });
    User.hasMany(models.File, {
      foreignKey: 'userId',
      as: 'files',
    });
    User.hasMany(models.Payment, {
      foreignKey: 'userId',
      as: 'payments',
    });
  };

  return User;
};
