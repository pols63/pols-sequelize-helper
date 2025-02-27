import { FindOptions, Includeable, Model, Op } from 'sequelize'
import { Cast, Col, Fn } from 'sequelize/lib/utils'

export type POrder = ([...{ model?: any, as: string }[], string, 'asc' | 'desc'] | [string, 'asc' | 'desc'])[]

export type PFilter = {
	text: string
	fields: (string | Fn | Col | Cast)[]
}

export type PIncludable = Includeable & {
	filter?: PFilter
}

export type PFindOptions = Omit<FindOptions, 'order' | 'include'> & {
	filter?: PFilter
	order?: POrder
	include?: PIncludable | PIncludable[]
}

const completeFilter = (model: typeof Model, options?: PFindOptions) => {
	if (!options?.filter?.fields.length || !options.filter?.text) return
	if (!options?.where) options.where = {}
	const sequelizeInstance = model.sequelize
	const opAnd: unknown[] = options.where[Op.and] ?? []
	const opOr: unknown[] = []
	const tokens = options.filter.text.split(' ')
	const dialect = sequelizeInstance.getDialect()
	for (const field of options.filter.fields) {
		const opAnd: unknown[] = []
		for (const token of tokens) {
			let likeValue = `%${token.toLowerCase()}%`
			if (token.match(/(?<!\*)\*(?!\*)/)) {
				likeValue = token.replace(/(?<!\*)\*(?!\*)/g, '%').toLowerCase()
			}
			let col: Fn
			if (typeof field == 'string') {
				col = sequelizeInstance.fn('lower', sequelizeInstance.col(`${model.name}.${field}`))
			} else {
				col = sequelizeInstance.fn('lower', field)
			}
			switch (dialect) {
				case 'mssql': {
					opAnd.push(sequelizeInstance.where(
						sequelizeInstance.fn('replace',
							sequelizeInstance.fn('replace',
								sequelizeInstance.fn('replace',
									sequelizeInstance.fn('replace',
										sequelizeInstance.fn('replace',
											col,
											'ú', 'u'),
										'ó', 'o'),
									'í', 'i'),
								'é', 'e'),
							'á', 'a'),
						{ [Op.like]: likeValue }
					))
					break
				}
				case 'postgres':
					opAnd.push(sequelizeInstance.where(sequelizeInstance.fn('translate', col, 'áéíóú', 'aeiou'),
						{ [Op.like]: likeValue }
					))
					break
			}
		}
		opOr.push(opAnd)
	}
	opAnd.push({ [Op.or]: opOr })
	options.where[Op.and] = opAnd
}

const completeInclude = (model: typeof Model, include: PIncludable | PIncludable[]) => {
	if (include instanceof Array) {
		for (const i of include as any[]) {
			const association = model.associations[i.as]
			if (association == null) throw new Error(`No se encontró relación con nombre '${i.as}'`)
			i.model = association.target
			i.required = i.required ?? false
			if (i.include) completeInclude(i.model, i.include)
			completeFilter(i.model, i)
		}
	} else {
		const i = include as any
		const association = model.associations[i.as]
		if (association == null) throw new Error(`No se encontró relación con nombre '${i.as}'`)
		i.model = association.target
		i.required = i.required ?? false
		if (i.include) completeInclude(i.model, i.include)
		completeFilter(i.model, i)
	}
}

const completeOrder = (model: typeof Model, order: POrder) => {
	if (!(order instanceof Array)) return
	for (const elementOrder of order) {
		if (!(elementOrder instanceof Array) || elementOrder.length < 3) continue

		/* Variable que mantiene al modelo del cuál se buscarán sus asociaciones */
		let targetModel = model
		for (let j = 0; j <= elementOrder.length - 3; j++) {
			const partOrder = elementOrder[j]
			if (typeof partOrder == 'string' || !('as' in partOrder)) continue
			const association = targetModel.associations[partOrder.as]
			if (association == null) throw new Error(`No se encontró relación con nombre '${partOrder.as}'`)
			partOrder.model = association.target
			targetModel = association.target
		}
	}
}

export const findAll = async <T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions): Promise<[T] extends [never] ? P[] : T[]> => {
	const m = model as any
	if (options?.include) completeInclude(m, options.include)
	if (options?.order) completeOrder(m, options.order)
	completeFilter(m, options)

	return await m.findAll(options)
}

export const findOne = async <T, P extends new () => any = new () => any>(model: P, options?: PFindOptions): Promise<[T] extends [never] ? P : T> => {
	const m = model as any
	if (options?.include) completeInclude(m, options.include)
	if (options?.order) completeOrder(m, options.order)
	completeFilter(m, options)

	return await m.findOne(options)
}