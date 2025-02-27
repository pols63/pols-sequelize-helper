import { Model, Sequelize, DataTypes } from 'sequelize'

export const sequelize = new Sequelize(
	'INT_Tawa_SBO',
	'sa',
	'10078612369Lore', {
	host: '10.10.0.22',
	dialect: 'mssql',
	timezone: '-05:00',
})

export class Test extends Model {
	declare id: string
	declare Nombres: string
	declare Apellidos: string
	declare Edad: number
	declare Ingreso: Date
}

Test.init({
	id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
	Nombres: { type: DataTypes.STRING },
	Apellidos: { type: DataTypes.STRING },
	Edad: { type: DataTypes.INTEGER },
	Ingreso: { type: DataTypes.DATE }
}, {
	tableName: 'Test',
	sequelize
})