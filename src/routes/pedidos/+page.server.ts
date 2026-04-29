import { fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, cambiarEstadoItemSchema, cambiarEstadoPedidoSchema, subirDisenoSchema, asignarItemSchema, eliminarPedidoSchema, marcarDisenoSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null
	const userId = usuario?.id ?? null

	const filtroEstado = url.searchParams.get('estado')
	const busqueda = url.searchParams.get('q')?.trim() || ''
	const fechaDesde = url.searchParams.get('desde')
	const fechaHasta = url.searchParams.get('hasta')
	const tipofecha = url.searchParams.get('tipofecha') === 'fecha_entrega' ? 'fecha_entrega' : 'created_at'
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
			 pedido_items(id, tipo, tipo_label, descripcion, precio_fabricacion, precio_cliente, estado_produccion, asignado_a, archivo_diseno_url, diseno_completado, notas_produccion, orden)`,
			{ count: 'exact' }
		)
		.order(ordenCampo, { ascending: ordenAsc, nullsFirst: false })

	if (filtroEstado) query = query.eq('estado', filtroEstado)
	if (busqueda) query = query.ilike('clientes.nombre', `%${busqueda}%`)
	if (fechaDesde) query = query.gte(tipofecha, fechaDesde)
	if (fechaHasta) query = query.lte(tipofecha, `${fechaHasta}T23:59:59`)

	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: pedidos, count, error: pedidosError } = await query

	if (pedidosError) {
		console.error('[pedidos.load] Error al consultar pedidos:', pedidosError)
	}

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
		fechaDesde,
		fechaHasta,
		tipofecha,
		rol,
		userId,
		perfiles,
		errorCarga: pedidosError?.message ?? null
	}
}

export const actions: Actions = {
	// Cambiar estado de producción de un item (admin o fabricador)
	cambiarEstadoItem: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'fabricador')) {
			return fail(403, { error: 'Sin permisos para cambiar estado de producción' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarEstadoItemSchema, form)
		if (esError(datos)) return datos

		const { data: actualizados, error } = await locals.supabase
			.from('pedido_items')
			.update({ estado_produccion: datos.estado })
			.eq('id', datos.item_id)
			.select('id')

		if (error) return fail(500, { error: 'Error al actualizar estado' })
		if (!actualizados || actualizados.length === 0) {
			return fail(403, { error: 'No se pudo actualizar el item (permisos de base de datos)' })
		}
		return { success: true }
	},

	// Cambiar estado general del pedido (solo admin)
	cambiarEstadoPedido: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'fabricador')) {
			return fail(403, { error: 'Sin permisos para cambiar el estado del pedido' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarEstadoPedidoSchema, form)
		if (esError(datos)) return datos

		const { data: actualizados, error } = await locals.supabase
			.from('pedidos')
			.update({ estado: datos.estado })
			.eq('id', datos.pedido_id)
			.select('id')

		if (error) return fail(500, { error: 'Error BD: ' + error.message })
		if (!actualizados || actualizados.length === 0) {
			return fail(403, { error: 'No se pudo actualizar el pedido (permisos de base de datos)' })
		}

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_estado_pedido',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nuevo_estado: datos.estado }
		})

		return { success: true }
	},

	// Subir archivo de diseño (admin o diseñador)
	subirDiseno: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'diseñador')) {
			return fail(403, { error: 'Sin permisos para subir diseños' })
		}

		const form = await request.formData()
		const datos = parseForm(subirDisenoSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ archivo_diseno_url: datos.archivo_url })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al subir diseño' })
		return { success: true }
	},

	// Asignar item a un usuario (solo admin)
	asignarItem: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede asignar items' })
		}

		const form = await request.formData()
		const datos = parseForm(asignarItemSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ asignado_a: datos.user_id || null })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al asignar' })
		return { success: true }
	},

	// Marcar diseño como completado / pendiente (admin o diseñador asignado)
	marcarDiseno: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'diseñador')) {
			return fail(403, { error: 'Sin permisos para marcar diseños' })
		}

		const form = await request.formData()
		const datos = parseForm(marcarDisenoSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ diseno_completado: datos.completado })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al actualizar diseño' })
		return { success: true }
	},

	// Eliminar pedido (solo admin)
	eliminarPedido: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar pedidos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarPedidoSchema, form)
		if (esError(datos)) return datos

		await locals.supabase.from('pedido_items').delete().eq('pedido_id', datos.pedido_id)

		const { error } = await locals.supabase.from('pedidos').delete().eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error al eliminar pedido' })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_pedido',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		return { success: true }
	}
}
