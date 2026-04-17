import { error, redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, actualizarItemCotSchema, actualizarTotalCotSchema, cambiarEstadoCotSchema, convertirPedidoSchema, eliminarCotSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	const { data: cotizacion, error: err } = await supabase
		.from('cotizaciones')
		.select(`
			*,
			clientes(id, nombre, empresa, contacto, email, ciudad),
			perfiles!cotizaciones_creado_por_fkey(nombre, rol),
			cotizacion_items(*)
		`)
		.eq('id', params.id)
		.single()

	if (err || !cotizacion) throw error(404, 'Cotización no encontrada')

	// Ordenar items
	const items = (cotizacion.cotizacion_items ?? []).sort(
		(a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0)
	)

	return {
		cotizacion: { ...cotizacion, cotizacion_items: items },
		rol,
		userId: usuario?.id ?? null
	}
}

export const actions: Actions = {
	// Actualizar precio de un item (admin o finanzas)
	actualizarItem: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para modificar precios' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarItemCotSchema, form)
		if (esError(datos)) return datos

		const { error: err } = await locals.supabase
			.from('cotizacion_items')
			.update({ precio_cliente: Math.round(datos.precio_cliente) })
			.eq('id', datos.item_id)

		if (err) return fail(500, { error: 'Error al actualizar item' })

		// Recalcular totales de la cotización
		const { data: items } = await locals.supabase
			.from('cotizacion_items')
			.select('precio_cliente')
			.eq('cotizacion_id', datos.cotizacion_id)

		const subtotal = (items ?? []).reduce((s, i) => s + Number(i.precio_cliente), 0)

		await locals.supabase
			.from('cotizaciones')
			.update({
				precio_subtotal: subtotal,
				precio_total: subtotal - datos.descuento
			})
			.eq('id', datos.cotizacion_id)

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_precio_item',
			tabla: 'cotizacion_items',
			registro_id: datos.item_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { precio_cliente: datos.precio_cliente, cotizacion_id: datos.cotizacion_id }
		})

		return { success: true }
	},

	// Actualizar precio total manualmente (admin o finanzas)
	actualizarTotal: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para modificar totales' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarTotalCotSchema, form)
		if (esError(datos)) return datos

		const { error: err } = await locals.supabase
			.from('cotizaciones')
			.update({ precio_total: Math.round(datos.precio_total) })
			.eq('id', datos.id)

		if (err) return fail(500, { error: 'Error al actualizar precio total' })

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_total_cotizacion',
			tabla: 'cotizaciones',
			registro_id: datos.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { precio_total: datos.precio_total }
		})

		return { success: true }
	},

	// Cambiar estado (admin o finanzas)
	cambiarEstado: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para cambiar estado' })
		}

		const form = await request.formData()
		const datos = parseForm(cambiarEstadoCotSchema, form)
		if (esError(datos)) return datos

		const { error: err } = await locals.supabase
			.from('cotizaciones')
			.update({ estado: datos.estado })
			.eq('id', datos.id)

		if (err) return fail(500, { error: 'Error al cambiar estado' })
		return { success: true }
	},

	// Convertir a pedido (admin o finanzas)
	convertirPedido: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para convertir a pedido' })
		}

		const form = await request.formData()
		const datos = parseForm(convertirPedidoSchema, form)
		if (esError(datos)) return datos

		const supabase = locals.supabase

		// Cargar cotización con items
		const { data: cot } = await supabase
			.from('cotizaciones')
			.select('*, cotizacion_items(*)')
			.eq('id', datos.id)
			.single()

		if (!cot) return fail(404, { error: 'Cotización no encontrada' })

		// Crear pedido (incluir abono si existe)
		const { data: pedido, error: errPedido } = await supabase
			.from('pedidos')
			.insert({
				cotizacion_id: cot.id,
				cliente_id: cot.cliente_id,
				creado_por: usuario.id,
				precio_total: cot.precio_total,
				abono: datos.abono > 0 ? datos.abono : 0,
				nota: cot.nota,
				imagen_url: cot.imagen_url
			})
			.select('id')
			.single()

		if (errPedido || !pedido) return fail(500, { error: 'Error al crear pedido' })

		// Registrar movimiento financiero del abono si es > 0
		if (datos.abono > 0) {
			await supabase
				.from('movimientos_financieros')
				.insert({
					pedido_id: pedido.id,
					tipo: 'abono',
					concepto: 'Abono inicial al crear pedido',
					monto: datos.abono,
					fecha: new Date().toISOString().slice(0, 10),
					registrado_por: usuario.id
				})
		}

		// Copiar items al pedido
		const pedidoItems = (cot.cotizacion_items ?? []).map((item: any) => ({
			pedido_id: pedido.id,
			tipo: item.tipo,
			tipo_label: item.tipo_label,
			descripcion: item.descripcion,
			precio_fabricacion: item.precio_fabricacion,
			precio_cliente: item.precio_cliente,
			archivo_diseno_url: item.parametros?.archivo_diseno_url ?? null,
			orden: item.orden
		}))

		if (pedidoItems.length > 0) {
			const { error: errItems } = await supabase
				.from('pedido_items')
				.insert(pedidoItems)
			if (errItems) return fail(500, { error: 'Error al copiar items al pedido' })
		}

		// Marcar cotización como convertida
		await supabase
			.from('cotizaciones')
			.update({ estado: 'aprobada' })
			.eq('id', datos.id)

		await registrarAudit(locals.supabase, {
			accion: 'convertir_a_pedido',
			tabla: 'cotizaciones',
			registro_id: datos.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { pedido_id: pedido.id, abono: datos.abono }
		})

		redirect(303, `/pedidos/${pedido.id}`)
	},

	// Eliminar cotización (admin o finanzas)
	eliminar: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para eliminar cotizaciones' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarCotSchema, form)
		if (esError(datos)) return datos

		// Primero eliminar items (cascade debería hacerlo, pero por seguridad)
		await locals.supabase
			.from('cotizacion_items')
			.delete()
			.eq('cotizacion_id', datos.id)

		const { error: err } = await locals.supabase
			.from('cotizaciones')
			.delete()
			.eq('id', datos.id)

		if (err) return fail(500, { error: 'Error al eliminar' })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_cotizacion',
			tabla: 'cotizaciones',
			registro_id: datos.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		redirect(303, '/cotizaciones')
	}
}
