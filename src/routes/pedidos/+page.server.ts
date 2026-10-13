import { fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, cambiarEstadoItemSchema, cambiarEstadoPedidoSchema, subirDisenoSchema, asignarItemSchema, eliminarPedidoSchema, marcarDisenoSchema, cambiarPrioridadSchema, marcarEntregadoSchema } from '$lib/utils/validate'
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

	// Vista: lista (detalle y búsqueda) · tablero (orden visual del taller)
	//        agenda (planear la semana) · calendario (el mes completo)
	const vistaParam = url.searchParams.get('vista')
	const vista: 'lista' | 'tablero' | 'agenda' | 'calendario' =
		vistaParam === 'tablero' || vistaParam === 'agenda' || vistaParam === 'calendario'
			? vistaParam
			: 'lista'

	// Mes visible en el calendario (YYYY-MM)
	const mesParam = url.searchParams.get('mes')
	const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam ?? '') ? (mesParam as string) : mesActual()

	// El tablero, la agenda y el calendario necesitan ver todo de una, no 20 por página
	const porPagina = vista === 'lista' ? 20 : 300

	// Fabricador: ordenar por fecha de entrega; otros: por fecha de creación
	const ordenCampo = rol === 'fabricador' ? 'fecha_entrega' : 'created_at'
	const ordenAsc = rol === 'fabricador' // entrega más próxima primero

	let query = supabase
		.from('pedidos')
		.select(
			`id, estado, precio_total, abono, saldo, fecha_entrega, nota, imagen_url, created_at,
			 requiere_instalacion, direccion_entrega, fecha_instalacion, fecha_entregado, prioridad,
			 clientes!inner(id, nombre, empresa, contacto),
			 perfiles!pedidos_creado_por_fkey(nombre),
			 pedido_items(id, tipo, tipo_label, descripcion, precio_fabricacion, precio_cliente, estado_produccion, asignado_a, archivo_diseno_url, diseno_completado, notas_produccion, orden),
			 pedido_compras(id, material, cantidad, estado, fecha_estimada, fecha_recibido, costo_real, proveedor_id, proveedores(id, nombre, contacto))`,
			{ count: 'exact' }
		)
		.order(ordenCampo, { ascending: ordenAsc, nullsFirst: false })

	if (vista === 'calendario') {
		// El calendario trae el mes completo sin importar el estado: los ya entregados
		// también deben verse en su día. Un pedido puede caer en el mes por la fecha
		// de entrega o por la de instalación.
		const { inicio, fin } = rangoMes(mes)
		query = query.or(
			`and(fecha_entrega.gte.${inicio},fecha_entrega.lte.${fin}),` +
				`and(fecha_instalacion.gte.${inicio},fecha_instalacion.lte.${fin})`
		)
	} else if (filtroEstado) {
		if (filtroEstado !== 'Todos') {
			query = query.eq('estado', filtroEstado)
		}
	} else if (vista === 'lista') {
		// Por defecto no mostrar los terminados ni entregados
		query = query.not('estado', 'in', '("Terminado","Entregado")')
	} else {
		// El tablero necesita la columna "Terminado"; "Entregado" solo lo reciente
		query = query.or('estado.neq.Entregado,fecha_entregado.gte.' + haceDias(30))
	}

	// `clientes!inner` es lo que hace que este filtro descarte filas en la BD.
	// Sin el !inner PostgREST solo vacía el embed y la paginación quedaba mal.
	if (busqueda) query = query.ilike('clientes.nombre', `%${busqueda}%`)

	// Los filtros de fecha sueltos no aplican al calendario: ya está acotado al mes
	if (vista !== 'calendario') {
		if (fechaDesde) query = query.gte(tipofecha, fechaDesde)
		if (fechaHasta) query = query.lte(tipofecha, `${fechaHasta}T23:59:59`)
	}

	const desde = (pagina - 1) * porPagina
	query = query.range(desde, desde + porPagina - 1)

	const { data: pedidos, count, error: pedidosError } = await query

	if (pedidosError) {
		console.error('[pedidos.load] Error al consultar pedidos:', pedidosError)
	}

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
		pedidos: pedidos ?? [],
		total: count ?? 0,
		pagina,
		porPagina,
		vista,
		mes,
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

/** Fecha YYYY-MM-DD de hace N días (para acotar los pedidos ya entregados) */
function haceDias(n: number): string {
	const d = new Date()
	d.setDate(d.getDate() - n)
	return d.toISOString().slice(0, 10)
}

/**
 * Mes actual en Colombia (UTC-5, sin horario de verano).
 * El servidor corre en UTC: sin el ajuste, entre las 7pm y medianoche del último
 * día del mes el calendario abriría en el mes siguiente.
 */
function mesActual(): string {
	const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
	return `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Primer y último día de un mes YYYY-MM, en formato YYYY-MM-DD */
function rangoMes(mes: string): { inicio: string; fin: string } {
	const anio = Number(mes.slice(0, 4))
	const num = Number(mes.slice(5, 7))
	const ultimo = new Date(Date.UTC(anio, num, 0)).getUTCDate()
	const mm = String(num).padStart(2, '0')
	return { inicio: `${mes}-01`, fin: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` }
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

	// Cambiar prioridad del pedido (solo admin) — ordena el tablero
	cambiarPrioridad: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede cambiar la prioridad' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarPrioridadSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedidos')
			.update({ prioridad: datos.prioridad })
			.eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error al cambiar la prioridad' })
		return { success: true }
	},

	// Marcar el pedido como entregado (admin o fabricador) — cierra el flujo
	marcarEntregado: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'fabricador')) {
			return fail(403, { error: 'Sin permisos para marcar la entrega' })
		}

		const form = await request.formData()
		const datos = parseForm(marcarEntregadoSchema, form)
		if (esError(datos)) return datos

		const cambios = datos.deshacer
			? { estado: 'Terminado', fecha_entregado: null, entregado_por: null, foto_entrega_url: null }
			: {
					estado: 'Entregado',
					fecha_entregado: new Date().toISOString(),
					entregado_por: usuario.id,
					foto_entrega_url: datos.foto_entrega_url || null
				}

		const { data: actualizados, error } = await locals.supabase
			.from('pedidos')
			.update(cambios)
			.eq('id', datos.pedido_id)
			.select('id')

		if (error) return fail(500, { error: 'Error BD: ' + error.message })
		if (!actualizados || actualizados.length === 0) {
			return fail(403, { error: 'No se pudo actualizar el pedido (permisos de base de datos)' })
		}

		await registrarAudit(locals.supabase, {
			accion: datos.deshacer ? 'deshacer_entrega' : 'marcar_entregado',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
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
