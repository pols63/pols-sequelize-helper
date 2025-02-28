import { sequelize, TestPadres } from "./models"
import { findAll, findAllByPage } from '../src/index'

const run = async () => {
	// const registros1 = await findAll(TestPadres, {
	// 	include: [{
	// 		as: 'Hijos',
	// 		limit: 3
	// 	}]
	// })
	// console.log(registros1)

	const registros2 = await findAllByPage(TestPadres, {
		order: [['Nombres', 'asc']],
		page: 2,
	})
	console.log(registros2)

	console.log('FIN')
}

run().then(() => { }).catch(console.error)