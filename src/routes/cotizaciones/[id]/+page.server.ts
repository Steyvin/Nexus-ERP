import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'

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
	// Actualizar precio de un item
	actualizarItem: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const precioCliente = Number(form.get('precio_cliente'))

		if (!itemId || isNaN(precioCliente)) return { error: 'Datos inválidos' }

		const { error: err } = await locals.supabase
			.from('cotizacion_items')
			.update({ precio_cliente: Math.round(precioCliente) })
			.eq('id', itemId)

		if (err) return { error: 'Error al actualizar item' }

		// Recalcular totales de la cotización
		const cotizacionId = form.get('cotizacion_id') as string
		const { data: items } = await locals.supabase
			.from('cotizacion_items')
			.select('precio_cliente')
			.eq('cotizacion_id', cotizacionId)

		const subtotal = (items ?? []).reduce((s, i) => s + Number(i.precio_cliente), 0)
		const descuento = Number(form.get('descuento') ?? 0)

		await locals.supabase
			.from('cotizaciones')
			.update({
				precio_subtotal: subtotal,
				precio_total: subtotal - descuento
			})
			.eq('id', cotizacionId)

		return { success: true }
	},

	// Cambiar estado
	cambiarEstado: async ({ request, locals }) => {
		const form = await request.formData()
		const id = form.get('id') as string
		const estado = form.get('estado') as string

		const { error: err } = await locals.supabase
			.from('cotizaciones')
			.update({ estado })
			.eq('id', id)

		if (err) return { error: 'Error al cambiar estado' }
		return { success: true }
	},

	// Convertir a pedido
	convertirPedido: async ({ request, locals }) => {
		const form = await request.formData()
		const cotId = form.get('id') as string
		const usuario = await locals.getUsuario()
		const supabase = locals.supabase

		// Cargar cotización con items
		const { data: cot } = await supabase
			.from('cotizaciones')
			.select('*, cotizacion_items(*)')
			.eq('id', cotId)
			.single()

		if (!cot) return { error: 'Cotización no encontrada' }

		// Crear pedido
		const { data: pedido, error: errPedido } = await supabase
			.from('pedidos')
			.insert({
				cotizacion_id: cot.id,
				cliente_id: cot.cliente_id,
				creado_por: usuario?.id ?? null,
				precio_total: cot.precio_total,
				nota: cot.nota,
				imagen_url: cot.imagen_url
			})
			.select('id')
			.single()

		if (errPedido || !pedido) return { error: 'Error al crear pedido' }

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
			if (errItems) return { error: 'Error al copiar items al pedido' }
		}

		// Marcar cotización como convertida
		await supabase
			.from('cotizaciones')
			.update({ estado: 'aprobada' })
			.eq('id', cotId)

		redirect(303, `/pedidos/${pedido.id}`)
	},

	// Eliminar cotización
	eliminar: async ({ request, locals }) => {
		const form = await request.formData()
		const id = form.get('id') as string

		// Primero eliminar items (cascade debería hacerlo, pero por seguridad)
		await locals.supabase
			.from('cotizacion_items')
			.delete()
			.eq('cotizacion_id', id)

		const { error: err } = await locals.supabase
			.from('cotizaciones')
			.delete()
			.eq('id', id)

		if (err) return { error: 'Error al eliminar' }
		redirect(303, '/cotizaciones')
	}
}
