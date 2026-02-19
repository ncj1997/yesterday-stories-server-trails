const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
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
    paymentIntentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'AUD',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'payments',
    timestamps: true,
    underscored: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['user_id'] },
      { fields: ['payment_intent_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Payment.belongsTo(models.Trail, {
      foreignKey: 'referenceCode',
      targetKey: 'referenceCode',
      as: 'trail',
    });
  };

  return Payment;
};
