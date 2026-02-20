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
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'userId',
    },
    paymentIntentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'paymentIntentId',
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'amount',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'AUD',
      field: 'currency',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'status',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'metadata',
    },
  }, {
    tableName: 'payments',
    timestamps: true,
    underscored: false,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['referenceCode'] },
      { fields: ['userId'] },
      { fields: ['paymentIntentId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.Trail, {
      foreignKey: 'referenceCode',
      targetKey: 'referenceCode',
      as: 'trail',
    });
  };

  return Payment;
};
