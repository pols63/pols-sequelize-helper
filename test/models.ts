import { Model, Sequelize, DataTypes } from 'sequelize'

export const sequelize = new Sequelize(
	'INT_Tawa_SBO',
	'sa',
	'10078612369Lore', {
	host: '10.10.0.22',
	dialect: 'mssql',
	timezone: '-05:00',
})

export class TestPadres extends Model {
	declare id: string
	declare Nombres: string
	declare Apellidos: string
	declare Edad: number
	declare Ingreso: Date
}

TestPadres.init({
	id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
	Nombres: { type: DataTypes.STRING },
	Apellidos: { type: DataTypes.STRING },
	Edad: { type: DataTypes.INTEGER },
	Ingreso: { type: DataTypes.DATE }
}, {
	tableName: TestPadres.name,
	sequelize
})

export class TestHijos extends Model {
	declare id: string
	declare idCabecera: string
	declare Dato: string
}

TestHijos.init({
	id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
	idCabecera: { type: DataTypes.BIGINT },
	Dato: { type: DataTypes.STRING },
}, {
	tableName: TestHijos.name,
	sequelize
})

TestPadres.hasMany(TestHijos, { as: 'Hijos', sourceKey: 'id', foreignKey: 'idCabecera' })
TestHijos.belongsTo(TestPadres, { as: 'Padre', targetKey: 'id', foreignKey: 'idCabecera' })