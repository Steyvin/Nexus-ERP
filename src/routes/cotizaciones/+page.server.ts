import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const filtroEstado = url.searchParams.get('estado') // pendiente, aprobada, convertida, cancelada
	const pagina = Math.max(1, Number(url.searchParams.get('p')) || 1)
	const porPagina = 20

	let query = supabase
		.from('cotizaciones')
		.select('id, estado, precio_total, descuento, created_at, clientes(nombre)', { count: 'exact' })
		.order('created_at', { ascending: false })

	if (filtroEstado) query = query.eq('estado', filtroEstado)

	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: cotizaciones, count } = await query

	return {
		cotizaciones: cotizaciones ?? [],
		total: count ?? 0,
		pagina,
		porPagina,
		filtroEstado
	}
}
