const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Token = sequelize.define('Token', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
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
    },
  }, {
    tableName: 'tokens',
    timestamps: true,
    underscored: true,
    createdAt: 'createdAt',
    updatedAt: false,
    indexes: [
      { fields: ['token'] },
      { fields: ['expires_at'] },
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
