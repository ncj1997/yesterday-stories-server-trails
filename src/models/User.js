const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'userId',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['userId'] },
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
    User.hasMany(models.Token, {
      foreignKey: 'userId',
      as: 'tokens',
    });
    User.hasMany(models.Payment, {
      foreignKey: 'userId',
      as: 'payments',
    });
  };

  return User;
};
