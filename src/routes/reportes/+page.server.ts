import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()

	// Solo admin y finanzas pueden ver reportes
	if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
		redirect(303, '/dashboard')
	}

	const supabase = locals.supabase
	const ahora = new Date()

	// ── Inicio semana actual (lunes ISO) ─────────────────────────────────────
	const dow = ahora.getDay() // 0=domingo
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

	const [semanasRes, productosTopRes, pedMesActualRes, pedMesAnteriorRes] = await Promise.all([
		// Resumen semanal (vista en BD)
		supabase
			.from('v_resumen_semanal')
			.select('semana_inicio, total_pedidos, ventas_brutas, costo_fabricacion, ganancia_bruta')
			.gte('semana_inicio', hace12Semanas.toISOString().slice(0, 10))
			.order('semana_inicio', { ascending: true }),

		// Top productos (vista en BD)
		supabase
			.from('v_productos_top')
			.select(
				'tipo_label, cantidad_vendida, ingresos_totales, costos_totales, ganancia_total, margen_promedio_pct'
			)
			.limit(8),

		// Pedidos mes actual con sus items (para costo de fabricación)
		supabase
			.from('pedidos')
			.select('id, precio_total, pedido_items(precio_fabricacion)')
			.gte('created_at', inicioMesActual.toISOString()),

		// Pedidos mes anterior con sus items
		supabase
			.from('pedidos')
			.select('id, precio_total, pedido_items(precio_fabricacion)')
			.gte('created_at', inicioMesAnterior.toISOString())
			.lt('created_at', inicioMesActual.toISOString())
	])

	// ── Resumen semana actual (desde la vista) ───────────────────────────────
	const semanaActualStr = inicioSemana.toISOString().slice(0, 10)
	const semanasData = semanasRes.data ?? []
	const semanaActualData = semanasData.find((s) => s.semana_inicio === semanaActualStr)

	const semanaActual = {
		ventas_brutas: Number(semanaActualData?.ventas_brutas ?? 0),
		costo_fabricacion: Number(semanaActualData?.costo_fabricacion ?? 0),
		ganancia_bruta: Number(semanaActualData?.ganancia_bruta ?? 0),
		total_pedidos: Number(semanaActualData?.total_pedidos ?? 0)
	}

	// ── Calcular totales por mes ─────────────────────────────────────────────
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

	return {
		semanaActual,
		semanas: semanasData,
		productosTop: productosTopRes.data ?? [],
		mesActual: calcMes((pedMesActualRes.data ?? []) as any),
		mesAnterior: calcMes((pedMesAnteriorRes.data ?? []) as any),
		nombreMesActual: `${meses[ahora.getMonth()]} ${ahora.getFullYear()}`,
		nombreMesAnterior: `${meses[(ahora.getMonth() + 11) % 12]} ${ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear()}`
	}
}
