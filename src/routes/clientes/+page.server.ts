import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase

	const busqueda = url.searchParams.get('q') ?? ''
	const filtroActivo = url.searchParams.get('activo') // 'true' | 'false' | null (todos)
	const pagina = Math.max(1, Number(url.searchParams.get('p')) || 1)
	const porPagina = 20

	// Query base
	let query = supabase
		.from('clientes')
		.select('*', { count: 'exact' })
		.order('created_at', { ascending: false })

	// Filtro de búsqueda (nombre, empresa, email, contacto)
	if (busqueda) {
		query = query.or(
			`nombre.ilike.%${busqueda}%,empresa.ilike.%${busqueda}%,email.ilike.%${busqueda}%,contacto.ilike.%${busqueda}%`
		)
	}

	// Filtro de estado activo/inactivo
	if (filtroActivo === 'true') query = query.eq('activo', true)
	else if (filtroActivo === 'false') query = query.eq('activo', false)

	// Paginación
	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: clientes, count } = await query

	return {
		clientes: clientes ?? [],
		total: count ?? 0,
		pagina,
		porPagina,
		busqueda,
		filtroActivo
	}
}
