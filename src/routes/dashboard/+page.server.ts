import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null
	const userId = usuario?.id ?? null

	// Fechas de referencia
	const ahora = new Date()
	const inicioSemana = new Date(ahora)
	inicioSemana.setDate(ahora.getDate() - ahora.getDay() + 1) // Lunes
	inicioSemana.setHours(0, 0, 0, 0)

	const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

	// ── Dashboard para DISEÑADOR: solo su trabajo asignado ──
	if (rol === 'diseñador' && userId) {
		const [misItemsRes, hechosSemanaRes] = await Promise.all([
			supabase
				.from('pedido_items')
				.select(`
					id, descripcion, tipo_label, diseno_completado, archivo_diseno_url, estado_produccion, created_at,
					pedidos!inner(id, estado, fecha_entrega, clientes(nombre))
				`)
				.eq('asignado_a', userId)
				.order('created_at', { ascending: false }),

			supabase
				.from('pedido_items')
				.select('id', { count: 'exact', head: true })
				.eq('asignado_a', userId)
				.eq('diseno_completado', true)
				.gte('updated_at', inicioSemana.toISOString())
		])

		const items = misItemsRes.data ?? []
		const pendientes = items.filter((i) => !i.diseno_completado).length
		const totalAsignados = items.length
		const pedidosActivos = new Set(
			items
				.filter((i) => (i.pedidos as any)?.estado !== 'Entregado')
				.map((i) => (i.pedidos as any)?.id)
		).size

		return {
			rol: 'diseñador' as const,
			disenosPendientes: pendientes,
			disenosHechosSemana: hechosSemanaRes.count ?? 0,
			pedidosActivos,
			totalAsignados,
			misItemsPendientes: items.filter((i) => !i.diseno_completado).slice(0, 5)
		}
	}

	// ── Dashboard para FABRICADOR: producción ──
	if (rol === 'fabricador') {
		const [pendientesRes, enFabRes, terminadosSemanaRes, pedidosProxRes] = await Promise.all([
			supabase
				.from('pedido_items')
				.select('id', { count: 'exact', head: true })
				.eq('estado_produccion', 'pendiente'),

			supabase
				.from('pedido_items')
				.select('id', { count: 'exact', head: true })
				.eq('estado_produccion', 'en_fabricacion'),

			supabase
				.from('pedido_items')
				.select('id', { count: 'exact', head: true })
				.eq('estado_produccion', 'terminado')
				.gte('updated_at', inicioSemana.toISOString()),

			supabase
				.from('pedidos')
				.select('id, estado, fecha_entrega, created_at, clientes(nombre)')
				.in('estado', ['Pedido realizado', 'En proceso', 'Enviado a proveedor', 'En fabricación'])
				.order('fecha_entrega', { ascending: true, nullsFirst: false })
				.limit(5)
		])

		return {
			rol: 'fabricador' as const,
			itemsPendientes: pendientesRes.count ?? 0,
			itemsEnFabricacion: enFabRes.count ?? 0,
			itemsTerminadosSemana: terminadosSemanaRes.count ?? 0,
			pedidosProximos: pedidosProxRes.data ?? []
		}
	}

	// ── Dashboard para ADMIN / FINANZAS ──
	const hace8Semanas = new Date(ahora)
	hace8Semanas.setDate(ahora.getDate() - 56)
	hace8Semanas.setHours(0, 0, 0, 0)

	const [
		ventasSemanaRes,
		cotizacionesPendientesRes,
		pedidosProduccionRes,
		pedidosEntregadosMesRes,
		pedidosRecientesRes,
		pedidos8SemanasRes
	] = await Promise.all([
		supabase
			.from('pedidos')
			.select('precio_total')
			.gte('created_at', inicioSemana.toISOString()),

		supabase
			.from('cotizaciones')
			.select('id', { count: 'exact', head: true })
			.eq('estado', 'pendiente'),

		supabase
			.from('pedidos')
			.select('id', { count: 'exact', head: true })
			.in('estado', ['Pedido realizado', 'En proceso', 'Enviado a proveedor', 'En fabricación']),

		supabase
			.from('pedidos')
			.select('id', { count: 'exact', head: true })
			.eq('estado', 'Entregado')
			.gte('updated_at', inicioMes.toISOString()),

		supabase
			.from('pedidos')
			.select('id, estado, precio_total, created_at, clientes(nombre)')
			.order('created_at', { ascending: false })
			.limit(5),

		supabase
			.from('pedidos')
			.select('precio_total, created_at')
			.gte('created_at', hace8Semanas.toISOString())
			.order('created_at', { ascending: true })
	])

	const ventasSemana = (ventasSemanaRes.data ?? []).reduce(
		(sum, p) => sum + Number(p.precio_total),
		0
	)
	const ventasPorSemana = agruparPorSemana(pedidos8SemanasRes.data ?? [], ahora)

	return {
		rol: (rol ?? 'admin') as 'admin' | 'finanzas',
		ventasSemana,
		cotizacionesPendientes: cotizacionesPendientesRes.count ?? 0,
		pedidosProduccion: pedidosProduccionRes.count ?? 0,
		pedidosEntregadosMes: pedidosEntregadosMesRes.count ?? 0,
		pedidosRecientes: pedidosRecientesRes.data ?? [],
		ventasPorSemana
	}
}

interface PedidoVenta {
	precio_total: number
	created_at: string
}

interface SemanaVenta {
	label: string
	total: number
}

function agruparPorSemana(pedidos: PedidoVenta[], ahora: Date): SemanaVenta[] {
	const semanas: SemanaVenta[] = []
	const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

	for (let i = 7; i >= 0; i--) {
		const inicioSem = new Date(ahora)
		inicioSem.setDate(ahora.getDate() - ahora.getDay() + 1 - i * 7)
		inicioSem.setHours(0, 0, 0, 0)

		const finSem = new Date(inicioSem)
		finSem.setDate(inicioSem.getDate() + 7)

		const total = pedidos
			.filter((p) => {
				const fecha = new Date(p.created_at)
				return fecha >= inicioSem && fecha < finSem
			})
			.reduce((sum, p) => sum + Number(p.precio_total), 0)

		const dia = inicioSem.getDate()
		const mes = meses[inicioSem.getMonth()]
		semanas.push({ label: `${dia} ${mes}`, total })
	}

	return semanas
}
