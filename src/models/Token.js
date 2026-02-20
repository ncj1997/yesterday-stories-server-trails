const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Token = sequelize.define('Token', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'userId',
      references: {
        model: 'users',
        key: 'userId',
      },
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expiresAt',
    },
  }, {
    tableName: 'tokens',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: false,
    indexes: [
      { fields: ['token'] },
      { fields: ['expiresAt'] },
    ],
  });

  Token.associate = (models) => {
    Token.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return Token;
};
