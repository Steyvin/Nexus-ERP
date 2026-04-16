import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null
	const userId = usuario?.id ?? null

	const filtroEstado = url.searchParams.get('estado')
	const busqueda = url.searchParams.get('q')?.trim() || ''
	const pagina = Math.max(1, Number(url.searchParams.get('p')) || 1)
	const porPagina = 20

	// Fabricador: ordenar por fecha de entrega; otros: por fecha de creación
	const ordenCampo = rol === 'fabricador' ? 'fecha_entrega' : 'created_at'
	const ordenAsc = rol === 'fabricador' // entrega más próxima primero

	let query = supabase
		.from('pedidos')
		.select(
			`id, estado, precio_total, abono, saldo, fecha_entrega, nota, imagen_url, created_at,
			 clientes(id, nombre, empresa, contacto),
			 perfiles!pedidos_creado_por_fkey(nombre),
			 pedido_items(id, tipo, tipo_label, descripcion, precio_fabricacion, precio_cliente, estado_produccion, asignado_a, archivo_diseno_url, notas_produccion, orden)`,
			{ count: 'exact' }
		)
		.order(ordenCampo, { ascending: ordenAsc, nullsFirst: false })

	if (filtroEstado) query = query.eq('estado', filtroEstado)
	if (busqueda) query = query.ilike('clientes.nombre', `%${busqueda}%`)

	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: pedidos, count } = await query

	const filtrados = busqueda
		? (pedidos ?? []).filter((p: any) => p.clientes !== null)
		: (pedidos ?? [])

	// Cargar perfiles para asignación (admin necesita asignar items)
	let perfiles: any[] = []
	if (rol === 'admin') {
		const { data } = await supabase
			.from('perfiles')
			.select('id, nombre, rol')
			.eq('activo', true)
			.order('nombre')
		perfiles = data ?? []
	}

	return {
		pedidos: filtrados,
		total: busqueda ? filtrados.length : (count ?? 0),
		pagina,
		porPagina,
		filtroEstado,
		busqueda,
		rol,
		userId,
		perfiles
	}
}

export const actions: Actions = {
	// Cambiar estado de producción de un item
	cambiarEstadoItem: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const estado = form.get('estado') as string

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ estado_produccion: estado })
			.eq('id', itemId)

		if (error) return { error: 'Error al actualizar estado' }
		return { success: true }
	},

	// Cambiar estado general del pedido (admin)
	cambiarEstadoPedido: async ({ request, locals }) => {
		const form = await request.formData()
		const pedidoId = form.get('pedido_id') as string
		const estado = form.get('estado') as string

		const { error } = await locals.supabase
			.from('pedidos')
			.update({ estado })
			.eq('id', pedidoId)

		if (error) return { error: 'Error al cambiar estado del pedido' }
		return { success: true }
	},

	// Subir archivo de diseño (diseñador)
	subirDiseno: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const url = (form.get('archivo_url') as string)?.trim()

		if (!url) return { error: 'URL del archivo es requerida' }

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ archivo_diseno_url: url })
			.eq('id', itemId)

		if (error) return { error: 'Error al subir diseño' }
		return { success: true }
	},

	// Asignar item a un usuario (admin)
	asignarItem: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const userId = form.get('user_id') as string

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ asignado_a: userId || null })
			.eq('id', itemId)

		if (error) return { error: 'Error al asignar' }
		return { success: true }
	},

	// Eliminar pedido (admin)
	eliminarPedido: async ({ request, locals }) => {
		const form = await request.formData()
		const pedidoId = form.get('pedido_id') as string

		await locals.supabase.from('pedido_items').delete().eq('pedido_id', pedidoId)

		const { error } = await locals.supabase.from('pedidos').delete().eq('id', pedidoId)

		if (error) return { error: 'Error al eliminar pedido' }
		return { success: true }
	}
}
