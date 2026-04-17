import { error, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, cambiarEstadoItemDetalleSchema, cambiarEstadoPedidoDetalleSchema, subirDisenoDetalleSchema, asignarItemDetalleSchema, agregarNotaSchema, actualizarPedidoSchema, marcarDisenoSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	const { data: pedido, error: err } = await supabase
		.from('pedidos')
		.select(`
			*,
			clientes(id, nombre, empresa, contacto, email, ciudad),
			perfiles!pedidos_creado_por_fkey(nombre, rol),
			pedido_items(*, perfiles!pedido_items_asignado_a_fkey(nombre, rol)),
			pedido_notas(*, perfiles!pedido_notas_autor_id_fkey(nombre))
		`)
		.eq('id', params.id)
		.single()

	if (err || !pedido) throw error(404, 'Pedido no encontrado')

	const items = (pedido.pedido_items ?? []).sort(
		(a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0)
	)
	const notas = (pedido.pedido_notas ?? []).sort(
		(a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	)

	// Perfiles para asignación (admin)
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
		pedido: { ...pedido, pedido_items: items, pedido_notas: notas },
		rol,
		userId: usuario?.id ?? null,
		perfiles
	}
}

// Helper: registra un cambio como nota automática
async function registrarCambio(
	supabase: any,
	pedidoId: string,
	autorId: string | null,
	contenido: string
) {
	await supabase.from('pedido_notas').insert({
		pedido_id: pedidoId,
		autor_id: autorId,
		contenido
	})
}

export const actions: Actions = {
	// Cambiar estado de producción de un item (admin o fabricador)
	cambiarEstadoItem: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'fabricador')) {
			return fail(403, { error: 'Sin permisos para cambiar estado de producción' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarEstadoItemDetalleSchema, form)
		if (esError(datos)) return datos

		const labels: Record<string, string> = {
			pendiente: 'Pendiente',
			en_fabricacion: 'En fabricación',
			terminado: 'Terminado'
		}

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ estado_produccion: datos.estado })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al actualizar estado' })

		// Registrar cambio en timeline
		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Estado] "${datos.descripcion}" cambió de ${labels[datos.estado_anterior] ?? datos.estado_anterior} a ${labels[datos.estado] ?? datos.estado}`
		)

		return { success: true }
	},

	// Cambiar estado general del pedido (admin o diseñador)
	cambiarEstadoPedido: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'diseñador')) {
			return fail(403, { error: 'Sin permisos para cambiar el estado del pedido' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarEstadoPedidoDetalleSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedidos')
			.update({ estado: datos.estado })
			.eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error BD: ' + error.message })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Estado] Pedido cambió de "${datos.estado_anterior}" a "${datos.estado}"`
		)

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_estado_pedido',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { anterior: datos.estado_anterior, nuevo: datos.estado }
		})

		return { success: true }
	},

	// Subir diseño (admin o diseñador)
	subirDiseno: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'diseñador')) {
			return fail(403, { error: 'Sin permisos para subir diseños' })
		}

		const form = await request.formData()
		const datos = parseForm(subirDisenoDetalleSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ archivo_diseno_url: datos.archivo_url })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al subir diseño' })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Diseño] Archivo subido para "${datos.descripcion}"`
		)

		return { success: true }
	},

	// Asignar item (solo admin)
	asignarItem: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede asignar items' })
		}

		const form = await request.formData()
		const datos = parseForm(asignarItemDetalleSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ asignado_a: datos.user_id || null })
			.eq('id', datos.item_id)

		if (error) return fail(500, { error: 'Error al asignar' })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			datos.user_id
				? `[Asignación] "${datos.descripcion}" asignado a ${datos.nombre_asignado}`
				: `[Asignación] "${datos.descripcion}" desasignado`
		)

		return { success: true }
	},

	// Agregar nota (cualquier usuario autenticado)
	agregarNota: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario) return fail(403, { error: 'Debes estar autenticado' })

		const form = await request.formData()
		const datos = parseForm(agregarNotaSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_notas')
			.insert({
				pedido_id: datos.pedido_id,
				autor_id: usuario.id,
				contenido: datos.contenido
			})

		if (error) return fail(500, { error: 'Error al agregar nota' })
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

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			datos.completado
				? `[Diseño] "${datos.descripcion}" marcado como completado`
				: `[Diseño] "${datos.descripcion}" marcado como pendiente`
		)

		return { success: true }
	},

	// Actualizar pedido (solo admin)
	actualizarPedido: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede actualizar pedidos' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarPedidoSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedidos')
			.update({
				fecha_entrega: datos.fecha_entrega || null,
				abono: Math.round(datos.abono),
				nota: datos.nota || null
			})
			.eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error al actualizar pedido' })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Edición] Información del pedido actualizada`
		)

		await registrarAudit(locals.supabase, {
			accion: 'actualizar_pedido',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { abono: datos.abono, fecha_entrega: datos.fecha_entrega }
		})

		return { success: true }
	}
}
