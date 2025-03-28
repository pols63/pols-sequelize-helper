import { PUtils } from 'pols-utils'
import { FindOptions, IncludeOptions, Model, Op, Sequelize } from 'sequelize'
import { Cast, Col, Fn } from 'sequelize/lib/utils'

export type POrder = ([...{ model?: any, as: string }[], string, 'asc' | 'desc'] | [string, 'asc' | 'desc'])[]

export type PFilter = {
	text: string
	fields: (string | Fn | Col | Cast)[]
}

export type PIncludeOptions = IncludeOptions & {
	filter?: PFilter
}

export type PFindOptions = Omit<FindOptions, 'order' | 'include'> & {
	filter?: PFilter
	order?: POrder
	include?: PIncludeOptions | PIncludeOptions[]
	page?: number
	rowsPerPage?: number
}

export type PFindAllConfig = {
	includeRequiredDefault?: boolean
	secureSeparate?: boolean
}

export type PFindAllByPageConfig = {
	includeRequiredDefault?: boolean
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

const completeInclude = (model: typeof Model, include: PIncludeOptions, secureSeparate = true, includeRequiredDefault = false) => {
	if (include == null || typeof include != 'object') return
	if (include.model) return
	const association = model.associations[include.as]
	if (association == null) throw new Error(`No se encontró relación con nombre '${include.as}'`)
	include.model = association.target
	if (include.required == null) include.required = includeRequiredDefault
	if (include.include) completeAnyInclude(model, include.include as any, secureSeparate)
	if (secureSeparate && association.associationType == 'HasMany') {
		include.separate = true
	}
	completeFilter(model, include as any)
}

const completeAnyInclude = (model: typeof Model, include: PIncludeOptions | PIncludeOptions[], secureSeparate = true, includeRequiredDefault = false) => {
	if (include instanceof Array) {
		for (const i of include) {
			completeInclude(model, i, secureSeparate, includeRequiredDefault)
		}
	} else {
		completeInclude(model, include, secureSeparate, includeRequiredDefault)
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

const includeIsOneToOne = (model: any, include: PIncludeOptions) => {
	const association = model.associations[include.as]
	if (association == null) throw new Error(`No se encontró relación con nombre '${include.as}'`)
	return ['BelongsTo', 'HasOne'].includes(association.associationType)
}

export const findAll: {
	<T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions, config?: PFindAllConfig): Promise<[T] extends [never] ? InstanceType<P>[] : T[]>
} & PFindAllConfig = async <T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions, config?: PFindAllConfig): Promise<[T] extends [never] ? InstanceType<P>[] : T[]> => {
	const m = model as unknown as typeof Model
	if (options?.include) completeAnyInclude(m, options.include, config?.secureSeparate ?? findAll.secureSeparate, config?.includeRequiredDefault ?? findAll.includeRequiredDefault)
	if (options?.order) completeOrder(m, options.order)
	completeFilter(m, options)

	return await (m as any).findAll(options)
}
findAll.includeRequiredDefault = false
findAll.secureSeparate = true

export const findOne = async <T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions): Promise<[T] extends [never] ? InstanceType<P> : T> => {
	const m = model as any
	if (options?.include) completeAnyInclude(m, options.include, false)
	if (options?.order) completeOrder(m, options.order)
	completeFilter(m, options)

	return await m.findOne(options)
}

export const count = async (model: any, options: PFindOptions): Promise<number> => {
	completeFilter(model, options)

	const optionsCopy = { ...options }

	if (optionsCopy.include) {
		if (optionsCopy.include instanceof Array) {
			const include: PIncludeOptions[] = []
			for (const i of optionsCopy.include) {
				if (includeIsOneToOne(model, i)) include.push(i)
			}
			optionsCopy.include = include
		} else {
			if (!includeIsOneToOne(model, optionsCopy.include)) delete optionsCopy.include
		}
	}

	if (optionsCopy.include) completeAnyInclude(model, optionsCopy.include)

	return await model.count(optionsCopy)
}

export const findAllByPage: {
	<T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions, config?: PFindAllByPageConfig): Promise<{
		rows: [T] extends [never] ? InstanceType<P>[] : T[]
		rowsCount: number
	}>
	rowsPerPage?: number
} & PFindAllByPageConfig = async <T = never, P extends new () => any = new () => any>(model: P, options?: PFindOptions, config?: PFindAllByPageConfig): Promise<{
	rows: [T] extends [never] ? InstanceType<P>[] : T[]
	rowsCount: number
}> => {
		let page = options.page != null ? Math.floor(PUtils.Number.forceNumber(options.page)) : -1
		let rowsPerPage = Math.floor(PUtils.Number.forceNumber(options.rowsPerPage ?? findAllByPage.rowsPerPage))

		if (page < 1 || rowsPerPage <= 0) {
			const records = await findAll<T, P>(model, options, {
				includeRequiredDefault: config?.includeRequiredDefault ?? findAllByPage.includeRequiredDefault
			})
			return {
				rows: records,
				rowsCount: records.length
			}
		} else {
			const rowsCount = await count(model, {
				...options,
				attributes: undefined
			})
			if (!rowsCount) {
				return {
					rows: [],
					rowsCount
				}
			}
			const limitPage = Math.max(Math.ceil(rowsCount / rowsPerPage), 1)
			page = page > limitPage ? limitPage : page

			const rows = await findAll(model, {
				...options,
				limit: rowsPerPage,
				offset: (page - 1) * rowsPerPage
			}, {
				secureSeparate: true,
				includeRequiredDefault: config?.includeRequiredDefault ?? findAllByPage.includeRequiredDefault
			})

			return {
				rows,
				rowsCount
			}
		}
	}
findAllByPage.includeRequiredDefault = false
findAllByPage.rowsPerPage = 50

export const selectQuery = (model: new () => any, options: PFindOptions): string => {
	const m = model as any
	if (options.include) completeAnyInclude(m, options.include)
	if (options.order) completeOrder(m, options.order)
	completeFilter(m, options)

	const sequelizeInstance = m.sequelize as Sequelize
	if (!sequelizeInstance) throw new Error(`No se ha inicializado la instancia`)
	const queryGenerator = sequelizeInstance.getQueryInterface().queryGenerator as any
	const tableName = queryGenerator.quoteTable({ schema: m._schema, tableName: model.name })
	const tableNameToReplace = queryGenerator.quoteTable({ tableName: '@@toreplace@@' }).replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.')

	return queryGenerator.selectQuery('@@toreplace@@', options).replace(/;$/, '').replace(new RegExp(tableNameToReplace, 'g'), tableName)
}

export const countQuery = (model: new () => any, options: PFindOptions): string => {
	const m = model as any

	if (options.include) completeAnyInclude(m, options.include)
	if (options.order) completeOrder(m, options.order)
	completeFilter(m, options)

	const sequelizeInstance = m.sequelize as Sequelize
	if (!sequelizeInstance) throw new Error(`No se ha inicializado la instancia`)
	const queryGenerator = sequelizeInstance.getQueryInterface().queryGenerator as any
	const tableName = queryGenerator.quoteTable({ schema: m._schema, tableName: model.name })
	const tableNameToReplace = queryGenerator.quoteTable({ tableName: '@@toreplace@@' }).replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.')

	return queryGenerator.selectQuery('@@toreplace@@', {
		...options,
		attributes: [[sequelizeInstance.fn('count', sequelizeInstance.col('*')), 'count']]
	}).replace(/;$/, '').replace(new RegExp(tableNameToReplace, 'g'), tableName)
}