import { error, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, cambiarEstadoItemDetalleSchema, cambiarEstadoPedidoDetalleSchema, subirDisenoDetalleSchema, asignarItemDetalleSchema, agregarNotaSchema, actualizarPedidoSchema, añadirAbonoSchema, marcarDisenoSchema, agregarAbonoSchema, eliminarAbonoSchema, crearCompraSchema, actualizarCompraSchema, eliminarCompraSchema, crearProveedorSchema, marcarEntregadoSchema } from '$lib/utils/validate'
import { ESTADO_COMPRA_LABEL } from '$lib/types'
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
			pedido_notas(*, perfiles!pedido_notas_autor_id_fkey(nombre)),
			pedido_compras(*, proveedores(id, nombre, contacto))
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
	const compras = (pedido.pedido_compras ?? []).sort(
		(a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	)

	// Proveedores para el selector de compras (el fabricador también los ve)
	const { data: proveedores } = await supabase
		.from('proveedores')
		.select('id, nombre, contacto, materiales')
		.eq('activo', true)
		.order('nombre')

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

	// Abonos del pedido (admin / finanzas)
	let abonos: any[] = []
	let bancos: any[] = []
	if (rol === 'admin' || rol === 'finanzas') {
		const [abonosRes, bancosRes] = await Promise.all([
			supabase
				.from('movimientos_financieros')
				.select('id, concepto, monto, fecha, created_at, banco_id, registrado_por, perfiles:registrado_por(nombre), bancos:banco_id(id, nombre, color)')
				.eq('pedido_id', params.id)
				.eq('tipo', 'abono')
				.order('created_at', { ascending: false }),
			supabase
				.from('bancos')
				.select('id, nombre, tipo, color')
				.eq('activo', true)
				.order('nombre')
		])
		abonos = abonosRes.data ?? []
		bancos = bancosRes.data ?? []
	}

	return {
		pedido: { ...pedido, pedido_items: items, pedido_notas: notas, pedido_compras: compras },
		rol,
		userId: usuario?.id ?? null,
		perfiles,
		proveedores: proveedores ?? [],
		abonos,
		bancos
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
				nota: datos.nota || null,
				requiere_instalacion: datos.requiere_instalacion,
				direccion_entrega: datos.direccion_entrega || null,
				// Si ya no requiere instalación, la fecha agendada deja de tener sentido
				fecha_instalacion: datos.requiere_instalacion ? datos.fecha_instalacion || null : null,
				prioridad: datos.prioridad
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
			detalles: { fecha_entrega: datos.fecha_entrega }
		})

		return { success: true }
	},

	// ── MATERIAL / COMPRAS A PROVEEDOR ────────────────────────────────────────

	// Registrar material que hay que comprar (admin o finanzas)
	crearCompra: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para registrar material' })
		}

		const form = await request.formData()
		const datos = parseForm(crearCompraSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase.from('pedido_compras').insert({
			pedido_id: datos.pedido_id,
			pedido_item_id: datos.pedido_item_id || null,
			proveedor_id: datos.proveedor_id || null,
			material: datos.material,
			cantidad: datos.cantidad || null,
			costo_real: Math.round(datos.costo_real),
			estado: datos.estado,
			fecha_pedido: datos.fecha_pedido || null,
			fecha_estimada: datos.fecha_estimada || null,
			notas: datos.notas || null,
			registrado_por: usuario.id
		})

		if (error) return fail(500, { error: 'Error al registrar material: ' + error.message })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Material] "${datos.material}" registrado como ${ESTADO_COMPRA_LABEL[datos.estado]}`
		)

		return { success: true }
	},

	// Cambiar estado de una compra (admin, finanzas o fabricador que recibe)
	actualizarCompra: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || !['admin', 'finanzas', 'fabricador'].includes(usuario.rol)) {
			return fail(403, { error: 'Sin permisos para actualizar material' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarCompraSchema, form)
		if (esError(datos)) return datos

		const cambios: Record<string, unknown> = { estado: datos.estado }

		// Las fechas se completan solas según el estado: menos campos que llenar a mano
		if (datos.estado === 'pedido') cambios.fecha_pedido = new Date().toISOString().slice(0, 10)
		if (datos.estado === 'recibido') cambios.fecha_recibido = new Date().toISOString().slice(0, 10)
		if (datos.estado === 'por_pedir') {
			cambios.fecha_pedido = null
			cambios.fecha_recibido = null
		}
		if (datos.fecha_estimada !== undefined && datos.fecha_estimada !== '') {
			cambios.fecha_estimada = datos.fecha_estimada
		}
		// El costo real solo lo toca quien ve plata
		if (datos.costo_real !== undefined && (usuario.rol === 'admin' || usuario.rol === 'finanzas')) {
			cambios.costo_real = Math.round(datos.costo_real)
		}

		const { data: compra, error } = await locals.supabase
			.from('pedido_compras')
			.update(cambios)
			.eq('id', datos.compra_id)
			.eq('pedido_id', datos.pedido_id)
			.select('material')
			.single()

		if (error) return fail(500, { error: 'Error al actualizar material: ' + error.message })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Material] "${compra?.material ?? 'Material'}" → ${ESTADO_COMPRA_LABEL[datos.estado]}`
		)

		return { success: true }
	},

	// Eliminar una compra registrada (admin o finanzas)
	eliminarCompra: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para eliminar material' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarCompraSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase
			.from('pedido_compras')
			.delete()
			.eq('id', datos.compra_id)
			.eq('pedido_id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error al eliminar material' })
		return { success: true }
	},

	// Crear proveedor sin salir del pedido (admin o finanzas)
	crearProveedor: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para crear proveedores' })
		}

		const form = await request.formData()
		const datos = parseForm(crearProveedorSchema, form)
		if (esError(datos)) return datos

		const { error } = await locals.supabase.from('proveedores').insert({
			nombre: datos.nombre,
			contacto: datos.contacto || null,
			ciudad: datos.ciudad || null,
			materiales: datos.materiales || null,
			notas: datos.notas || null
		})

		if (error) return fail(500, { error: 'Error al crear proveedor: ' + error.message })
		return { success: true }
	},

	// ── ENTREGA ───────────────────────────────────────────────────────────────

	// Cerrar el pedido con evidencia de entrega (admin o fabricador)
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

		const { error } = await locals.supabase
			.from('pedidos')
			.update(cambios)
			.eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error BD: ' + error.message })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			datos.deshacer
				? '[Entrega] Entrega deshecha, el pedido vuelve a Terminado'
				: `[Entrega] Pedido entregado${datos.foto_entrega_url ? ' (con foto de evidencia)' : ''}`
		)

		await registrarAudit(locals.supabase, {
			accion: datos.deshacer ? 'deshacer_entrega' : 'marcar_entregado',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		return { success: true }
	},

	// Agregar abono al pedido (admin o finanzas)
	agregarAbono: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para registrar abonos' })
		}

		const form = await request.formData()
		const datos = parseForm(agregarAbonoSchema, form)
		if (esError(datos)) return datos

		const supabase = locals.supabase

		// Cargar total actual del pedido para validar que no se exceda
		const { data: pedido, error: errPedido } = await supabase
			.from('pedidos')
			.select('precio_total, abono')
			.eq('id', datos.pedido_id)
			.single()

		if (errPedido || !pedido) return fail(404, { error: 'Pedido no encontrado' })

		const monto = Math.round(datos.monto)
		const abonoActual = Number(pedido.abono) || 0
		const total = Number(pedido.precio_total) || 0
		const nuevoAbono = abonoActual + monto

		if (nuevoAbono > total) {
			return fail(400, { error: `El abono excede el saldo pendiente (máximo ${total - abonoActual})` })
		}

		// 1. Actualizar abono acumulado
		const { error: errUpdate } = await supabase
			.from('pedidos')
			.update({ abono: nuevoAbono })
			.eq('id', datos.pedido_id)

		if (errUpdate) return fail(500, { error: 'Error al actualizar el abono' })

		// 2. Registrar movimiento financiero
		const concepto = datos.concepto?.trim() || 'Abono'
		await supabase.from('movimientos_financieros').insert({
			pedido_id: datos.pedido_id,
			tipo: 'abono',
			concepto,
			monto,
			fecha: new Date().toISOString().slice(0, 10),
			registrado_por: usuario.id,
			banco_id: datos.banco_id ?? null
		})

		// 3. Registrar en timeline (incluye banco si aplica)
		let contenido = `[Abono] Abono de $${monto.toLocaleString('es-CO')} — ${concepto}`
		if (datos.banco_id) {
			const { data: banco } = await supabase
				.from('bancos')
				.select('nombre')
				.eq('id', datos.banco_id)
				.single()
			if (banco?.nombre) contenido += ` (en ${banco.nombre})`
		}

		await registrarCambio(supabase, datos.pedido_id, usuario.id, contenido)

		await registrarAudit(supabase, {
			accion: 'agregar_abono',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { monto, concepto, banco_id: datos.banco_id, nuevo_abono_total: nuevoAbono }
		})

		return { success: true }
	},

	// Eliminar un abono registrado (admin o finanzas)
	eliminarAbono: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para eliminar abonos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarAbonoSchema, form)
		if (esError(datos)) return datos

		const supabase = locals.supabase

		// Cargar el movimiento a eliminar
		const { data: movimiento, error: errMov } = await supabase
			.from('movimientos_financieros')
			.select('id, monto, concepto, pedido_id, tipo')
			.eq('id', datos.movimiento_id)
			.single()

		if (errMov || !movimiento) return fail(404, { error: 'Abono no encontrado' })
		if (movimiento.tipo !== 'abono' || movimiento.pedido_id !== datos.pedido_id) {
			return fail(400, { error: 'Movimiento inválido' })
		}

		// Cargar pedido para recalcular abono
		const { data: pedido, error: errPedido } = await supabase
			.from('pedidos')
			.select('abono')
			.eq('id', datos.pedido_id)
			.single()

		if (errPedido || !pedido) return fail(404, { error: 'Pedido no encontrado' })

		const monto = Number(movimiento.monto) || 0
		const nuevoAbono = Math.max(0, (Number(pedido.abono) || 0) - monto)

		// 1. Actualizar abono acumulado
		const { error: errUpdate } = await supabase
			.from('pedidos')
			.update({ abono: nuevoAbono })
			.eq('id', datos.pedido_id)

		if (errUpdate) return fail(500, { error: 'Error al actualizar el abono' })

		// 2. Eliminar movimiento
		const { error: errDelete } = await supabase
			.from('movimientos_financieros')
			.delete()
			.eq('id', datos.movimiento_id)

		if (errDelete) return fail(500, { error: 'Error al eliminar el abono' })

		// 3. Registrar en timeline
		await registrarCambio(
			supabase,
			datos.pedido_id,
			usuario.id,
			`[Abono] Abono eliminado de $${monto.toLocaleString('es-CO')} — ${movimiento.concepto ?? 'Abono'}`
		)

		await registrarAudit(supabase, {
			accion: 'eliminar_abono',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: {
				movimiento_id: datos.movimiento_id,
				monto,
				concepto: movimiento.concepto,
				nuevo_abono_total: nuevoAbono
			}
		})

		return { success: true }
	},

	// Añadir abono parcial (admin o finanzas)
	añadirAbono: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Solo admin y finanzas pueden añadir abonos' })
		}

		const form = await request.formData()
		const datos = parseForm(añadirAbonoSchema, form)
		if (esError(datos)) return datos

		if (datos.monto <= 0) return fail(400, { error: 'El monto debe ser mayor a 0' })

		// Get current abono
		const { data: pedido, error: errPed } = await locals.supabase
			.from('pedidos')
			.select('abono')
			.eq('id', datos.pedido_id)
			.single()

		if (errPed || !pedido) return fail(404, { error: 'Pedido no encontrado' })

		const nuevoAbono = Number(pedido.abono || 0) + datos.monto

		const { error } = await locals.supabase
			.from('pedidos')
			.update({ abono: nuevoAbono })
			.eq('id', datos.pedido_id)

		if (error) return fail(500, { error: 'Error al añadir abono' })

		await registrarCambio(
			locals.supabase,
			datos.pedido_id,
			usuario.id,
			`[Edición] Se añadió un abono de $${datos.monto}`
		)

		await registrarAudit(locals.supabase, {
			accion: 'anadir_abono',
			tabla: 'pedidos',
			registro_id: datos.pedido_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { monto_añadido: datos.monto, abono_anterior: pedido.abono, nuevo_abono: nuevoAbono }
		})

		return { success: true }
	}
}
