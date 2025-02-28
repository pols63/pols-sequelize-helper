import { sequelize, TestHijos, TestPadres } from "./models"
import randomNames from 'random-name'

sequelize.sync().then(async () => {
	for (let i = 0; i < 50; i++) {
		const padre = TestPadres.build()
		padre.Nombres = randomNames.first()
		padre.Apellidos = randomNames.last()
		padre.Edad = Math.floor(Math.random() * 50)
		await padre.save()

		for (let j = 0; j < 50; j++) {
			const hijo = TestHijos.build()
			hijo.Dato = randomNames.middle()
			hijo.idCabecera = padre.id
			await hijo.save()
		}
	}
})