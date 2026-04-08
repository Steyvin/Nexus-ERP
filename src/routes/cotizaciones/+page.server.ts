import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const filtroEstado = url.searchParams.get('estado')
	const busqueda = url.searchParams.get('q')?.trim() || ''
	const fechaDesde = url.searchParams.get('desde')
	const fechaHasta = url.searchParams.get('hasta')
	const pagina = Math.max(1, Number(url.searchParams.get('p')) || 1)
	const porPagina = 20

	// Obtener el rol del usuario para controlar visibilidad de costos
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	let query = supabase
		.from('cotizaciones')
		.select(
			'id, estado, precio_subtotal, precio_total, descuento, nota, created_at, clientes(nombre, empresa), perfiles!cotizaciones_creado_por_fkey(nombre), cotizacion_items(id, tipo_label, precio_fabricacion, precio_cliente)',
			{ count: 'exact' }
		)
		.order('created_at', { ascending: false })

	if (filtroEstado) {
		query = query.eq('estado', filtroEstado)
	} else {
		// Por defecto, ocultar cotizaciones ya convertidas a pedido
		query = query.neq('estado', 'aprobada')
	}

	if (busqueda) {
		query = query.ilike('clientes.nombre', `%${busqueda}%`)
	}

	if (fechaDesde) query = query.gte('created_at', fechaDesde)
	if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`)

	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: cotizaciones, count } = await query

	// Si se busca por cliente, Supabase puede devolver filas con clientes = null
	// (inner filter on foreign table). Filtrar esas filas.
	const filtradas = busqueda
		? (cotizaciones ?? []).filter((c: any) => c.clientes !== null)
		: (cotizaciones ?? [])

	return {
		cotizaciones: filtradas,
		total: busqueda ? filtradas.length : (count ?? 0),
		pagina,
		porPagina,
		filtroEstado,
		busqueda,
		fechaDesde,
		fechaHasta,
		rol
	}
}
