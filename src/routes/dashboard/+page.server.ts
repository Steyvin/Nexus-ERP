import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase

	// Fechas de referencia
	const ahora = new Date()
	const inicioSemana = new Date(ahora)
	inicioSemana.setDate(ahora.getDate() - ahora.getDay() + 1) // Lunes
	inicioSemana.setHours(0, 0, 0, 0)

	const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

	// 8 semanas atrás para el gráfico
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
		// 1. Ventas de la semana actual (suma precio_total de pedidos creados esta semana)
		supabase
			.from('pedidos')
			.select('precio_total')
			.gte('created_at', inicioSemana.toISOString()),

		// 2. Cotizaciones pendientes
		supabase
			.from('cotizaciones')
			.select('id', { count: 'exact', head: true })
			.eq('estado', 'pendiente'),

		// 3. Pedidos en producción (estados intermedios)
		supabase
			.from('pedidos')
			.select('id', { count: 'exact', head: true })
			.in('estado', ['Pedido realizado', 'En proceso', 'Enviado a proveedor', 'En fabricación']),

		// 4. Pedidos entregados este mes
		supabase
			.from('pedidos')
			.select('id', { count: 'exact', head: true })
			.eq('estado', 'Entregado')
			.gte('updated_at', inicioMes.toISOString()),

		// 5. Últimos 5 pedidos con cliente
		supabase
			.from('pedidos')
			.select('id, estado, precio_total, created_at, clientes(nombre)')
			.order('created_at', { ascending: false })
			.limit(5),

		// 6. Pedidos de las últimas 8 semanas para gráfico
		supabase
			.from('pedidos')
			.select('precio_total, created_at')
			.gte('created_at', hace8Semanas.toISOString())
			.order('created_at', { ascending: true })
	])

	// Calcular ventas de la semana
	const ventasSemana = (ventasSemanaRes.data ?? []).reduce(
		(sum, p) => sum + Number(p.precio_total),
		0
	)

	// Agrupar ventas por semana para el gráfico
	const ventasPorSemana = agruparPorSemana(pedidos8SemanasRes.data ?? [], ahora)

	return {
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
