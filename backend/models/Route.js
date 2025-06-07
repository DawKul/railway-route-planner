const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Route extends Model {}

Route.init({
    route_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    params: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    is_circular: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_bidirectional: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    visibility: {
        type: DataTypes.STRING(20),
        defaultValue: 'public'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Route',
    tableName: 'routes',
    timestamps: false
});

module.exports = Route; 