import { sequelize, Test } from "./models"
import { findAll, findAllByPage } from '../src/index'

sequelize.sync().then(async () => {
	await Test.findOrCreate({
		where: {
			id: 1
		},
		defaults: {
			Nombres: 'Jean Paul',
			Apellidos: 'Sánchez Mendoza',
			Edad: 42,
			Ingreso: '2025-01-01 00:00:00'
		}
	})
	await Test.findOrCreate({
		where: {
			id: 2
		},
		defaults: {
			Nombres: 'Raúl Andrés',
			Apellidos: 'Deniro Artego',
			Edad: 42,
			Ingreso: '2024-05-18 00:00:00'
		}
	})
	await Test.findOrCreate({
		where: {
			id: 3
		},
		defaults: {
			Nombres: 'Carmen Beatríz',
			Apellidos: 'Luna Real',
			Edad: 25,
			Ingreso: '2023-05-18 00:00:00'
		}
	})

	const registros1 = await findAll(Test)
	console.log(registros1)
	registros1[0]

	const registros2 = await findAll(Test, {
		where: { id: 1 }
	})
	console.log(registros2)

	const registros3 = await findAll<{ Cantidad: number }>(Test, {
		filter: {
			text: 'bea',
			fields: ['Nombres', 'Apellidos']
		},
		attributes: [
			[sequelize.fn('count', sequelize.col('*')), 'Cantidad']
		],
		raw: true
	})
	console.log(registros3)

	const registros4 = await findAllByPage(Test, {}, 5)

	console.log('FIN')
})