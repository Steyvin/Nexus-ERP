import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.getUsuario()

	// Solo admin y finanzas pueden ver reportes
	if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
		redirect(303, '/dashboard')
	}

	const supabase = locals.supabase
	const ahora = new Date()

	const fechaDesde = url.searchParams.get('desde')
	const fechaHasta = url.searchParams.get('hasta')

	// ── Inicio semana actual (lunes ISO) ─────────────────────────────────────
	const dow = ahora.getDay()
	const diasDesdelunes = (dow + 6) % 7
	const inicioSemana = new Date(ahora)
	inicioSemana.setDate(ahora.getDate() - diasDesdelunes)
	inicioSemana.setHours(0, 0, 0, 0)

	// ── Meses ────────────────────────────────────────────────────────────────
	const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
	const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)

	// ── 12 semanas para el gráfico ───────────────────────────────────────────
	const hace12Semanas = new Date(inicioSemana)
	hace12Semanas.setDate(inicioSemana.getDate() - 11 * 7)

	// ── Semanas comparativas ─────────────────────────────────────────────────
	const finSemana = new Date(inicioSemana)
	finSemana.setDate(inicioSemana.getDate() + 6)
	finSemana.setHours(23, 59, 59, 999)

	const inicioSemanaAnterior = new Date(inicioSemana)
	inicioSemanaAnterior.setDate(inicioSemana.getDate() - 7)

	const finSemanaAnterior = new Date(inicioSemanaAnterior)
	finSemanaAnterior.setDate(inicioSemanaAnterior.getDate() + 6)
	finSemanaAnterior.setHours(23, 59, 59, 999)

	// ── Query para el período seleccionado (KPIs superiores) ─────────────────
	let periodoQuery = supabase
		.from('pedidos')
		.select('id, precio_total, clientes(nombre), pedido_items(id, tipo_label, estado_produccion, precio_cliente, precio_fabricacion)')

	if (fechaDesde || fechaHasta) {
		if (fechaDesde) periodoQuery = periodoQuery.gte('created_at', fechaDesde)
		if (fechaHasta) periodoQuery = periodoQuery.lte('created_at', `${fechaHasta}T23:59:59`)
	} else {
		// Por defecto: semana actual
		periodoQuery = periodoQuery.gte('created_at', inicioSemana.toISOString())
	}

	const [semanasRes, productosTopRes, pedMesActualRes, pedMesAnteriorRes, pedSemanaActualRes, pedSemanaAnteriorRes, periodoRes, deudoresRes] =
		await Promise.all([
			supabase
				.from('v_resumen_semanal')
				.select('semana_inicio, total_pedidos, ventas_brutas, costo_fabricacion, ganancia_bruta')
				.gte('semana_inicio', hace12Semanas.toISOString().slice(0, 10))
				.order('semana_inicio', { ascending: true }),

			supabase
				.from('v_productos_top')
				.select(
					'tipo_label, cantidad_vendida, ingresos_totales, costos_totales, ganancia_total, margen_promedio_pct'
				)
				.limit(8),

			supabase
				.from('pedidos')
				.select('id, precio_total, pedido_items(precio_fabricacion)')
				.gte('created_at', inicioMesActual.toISOString()),

			supabase
				.from('pedidos')
				.select('id, precio_total, pedido_items(precio_fabricacion)')
				.gte('created_at', inicioMesAnterior.toISOString())
				.lt('created_at', inicioMesActual.toISOString()),

			supabase
				.from('pedidos')
				.select('id, precio_total, pedido_items(precio_fabricacion)')
				.gte('created_at', inicioSemana.toISOString())
				.lte('created_at', finSemana.toISOString()),

			supabase
				.from('pedidos')
				.select('id, precio_total, pedido_items(precio_fabricacion)')
				.gte('created_at', inicioSemanaAnterior.toISOString())
				.lte('created_at', finSemanaAnterior.toISOString()),

			periodoQuery,

			supabase
				.from('pedidos')
				.select('id, saldo, precio_total, abono, clientes(nombre), pedido_items(tipo_label, descripcion)')
				.gt('saldo', 0)
				.order('created_at', { ascending: false })
		])

	// ── Calcular totales ─────────────────────────────────────────────────────
	function calcMes(pedidos: { precio_total: number; pedido_items: { precio_fabricacion: number }[] }[]) {
		const ventas = pedidos.reduce((s, p) => s + Number(p.precio_total ?? 0), 0)
		const costo = pedidos.reduce(
			(s, p) =>
				s +
				(p.pedido_items ?? []).reduce(
					(si: number, i: { precio_fabricacion: number }) =>
						si + Number(i.precio_fabricacion ?? 0),
					0
				),
			0
		)
		return {
			ventas,
			costo,
			ganancia: ventas - costo,
			pedidos: pedidos.length,
			margen: ventas > 0 ? Math.round(((ventas - costo) / ventas) * 100) : 0
		}
	}

	const meses = [
		'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
		'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
	]

	const pedidosPeriodo = (periodoRes.data ?? []) as any[]
	const itemsPeriodo = pedidosPeriodo.flatMap(p => 
		(p.pedido_items ?? []).map((i: any) => ({ ...i, cliente_nombre: p.clientes?.nombre, pedido_id: p.id }))
	)

	const deudores = (deudoresRes.data ?? []) as any[]
	const totalMeDeben = deudores.reduce((sum, p) => sum + Number(p.saldo ?? 0), 0)

	return {
		periodo: calcMes(pedidosPeriodo),
		fechaDesde,
		fechaHasta,
		semanas: semanasRes.data ?? [],
		productosTop: productosTopRes.data ?? [],
		mesActual: calcMes((pedMesActualRes.data ?? []) as any),
		mesAnterior: calcMes((pedMesAnteriorRes.data ?? []) as any),
		semanaActual: calcMes((pedSemanaActualRes.data ?? []) as any),
		semanaAnterior: calcMes((pedSemanaAnteriorRes.data ?? []) as any),
		nombreMesActual: `${meses[ahora.getMonth()]} ${ahora.getFullYear()}`,
		nombreMesAnterior: `${meses[(ahora.getMonth() + 11) % 12]} ${ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear()}`,
		itemsPeriodo,
		deudores,
		totalMeDeben
	}
}
