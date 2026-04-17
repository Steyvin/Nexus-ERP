import { fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()

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
		filtroActivo,
		rol: usuario?.rol ?? null
	}
}

export const actions: Actions = {
	eliminarCliente: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar clientes' })
		}

		const form = await request.formData()
		const clienteId = form.get('cliente_id')?.toString()
		if (!clienteId) return fail(400, { error: 'ID de cliente requerido' })

		// Eliminar en cascada: pedido_items → pedidos → cotizacion_items → cotizaciones → cliente
		const { data: pedidos } = await locals.supabase.from('pedidos').select('id').eq('cliente_id', clienteId)
		if (pedidos && pedidos.length > 0) {
			const pedidoIds = pedidos.map((p: any) => p.id)
			await locals.supabase.from('pedido_items').delete().in('pedido_id', pedidoIds)
			await locals.supabase.from('pedidos').delete().eq('cliente_id', clienteId)
		}

		const { data: cotizaciones } = await locals.supabase.from('cotizaciones').select('id').eq('cliente_id', clienteId)
		if (cotizaciones && cotizaciones.length > 0) {
			const cotIds = cotizaciones.map((c: any) => c.id)
			await locals.supabase.from('cotizacion_items').delete().in('cotizacion_id', cotIds)
			await locals.supabase.from('cotizaciones').delete().eq('cliente_id', clienteId)
		}

		const { error } = await locals.supabase.from('clientes').delete().eq('id', clienteId)
		if (error) return fail(500, { error: 'Error al eliminar cliente' })

		return { success: true }
	}
}
