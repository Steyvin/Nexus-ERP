import { error } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'

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
	cambiarEstadoItem: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const nuevoEstado = form.get('estado') as string
		const pedidoId = form.get('pedido_id') as string
		const descripcion = form.get('descripcion') as string
		const estadoAnterior = form.get('estado_anterior') as string
		const usuario = await locals.getUsuario()

		const labels: Record<string, string> = {
			pendiente: 'Pendiente',
			en_fabricacion: 'En fabricación',
			terminado: 'Terminado'
		}

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ estado_produccion: nuevoEstado })
			.eq('id', itemId)

		if (error) return { error: 'Error al actualizar estado' }

		// Registrar cambio en timeline
		await registrarCambio(
			locals.supabase,
			pedidoId,
			usuario?.id ?? null,
			`[Estado] "${descripcion}" cambió de ${labels[estadoAnterior] ?? estadoAnterior} a ${labels[nuevoEstado] ?? nuevoEstado}`
		)

		return { success: true }
	},

	cambiarEstadoPedido: async ({ request, locals }) => {
		const form = await request.formData()
		const pedidoId = form.get('pedido_id') as string
		const nuevoEstado = form.get('estado') as string
		const estadoAnterior = form.get('estado_anterior') as string
		const usuario = await locals.getUsuario()

		const { error } = await locals.supabase
			.from('pedidos')
			.update({ estado: nuevoEstado })
			.eq('id', pedidoId)

		if (error) return { error: 'Error al cambiar estado del pedido' }

		await registrarCambio(
			locals.supabase,
			pedidoId,
			usuario?.id ?? null,
			`[Estado] Pedido cambió de "${estadoAnterior}" a "${nuevoEstado}"`
		)

		return { success: true }
	},

	subirDiseno: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const pedidoId = form.get('pedido_id') as string
		const descripcion = form.get('descripcion') as string
		const url = (form.get('archivo_url') as string)?.trim()
		const usuario = await locals.getUsuario()

		if (!url) return { error: 'URL del archivo es requerida' }

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ archivo_diseno_url: url })
			.eq('id', itemId)

		if (error) return { error: 'Error al subir diseño' }

		await registrarCambio(
			locals.supabase,
			pedidoId,
			usuario?.id ?? null,
			`[Diseño] Archivo subido para "${descripcion}"`
		)

		return { success: true }
	},

	asignarItem: async ({ request, locals }) => {
		const form = await request.formData()
		const itemId = form.get('item_id') as string
		const userId = form.get('user_id') as string
		const pedidoId = form.get('pedido_id') as string
		const descripcion = form.get('descripcion') as string
		const nombreAsignado = form.get('nombre_asignado') as string
		const usuario = await locals.getUsuario()

		const { error } = await locals.supabase
			.from('pedido_items')
			.update({ asignado_a: userId || null })
			.eq('id', itemId)

		if (error) return { error: 'Error al asignar' }

		await registrarCambio(
			locals.supabase,
			pedidoId,
			usuario?.id ?? null,
			userId
				? `[Asignación] "${descripcion}" asignado a ${nombreAsignado}`
				: `[Asignación] "${descripcion}" desasignado`
		)

		return { success: true }
	},

	agregarNota: async ({ request, locals }) => {
		const form = await request.formData()
		const pedidoId = form.get('pedido_id') as string
		const contenido = (form.get('contenido') as string)?.trim()
		const usuario = await locals.getUsuario()

		if (!contenido) return { error: 'La nota no puede estar vacía' }

		const { error } = await locals.supabase
			.from('pedido_notas')
			.insert({
				pedido_id: pedidoId,
				autor_id: usuario?.id ?? null,
				contenido
			})

		if (error) return { error: 'Error al agregar nota' }
		return { success: true }
	},

	actualizarPedido: async ({ request, locals }) => {
		const form = await request.formData()
		const pedidoId = form.get('pedido_id') as string
		const fechaEntrega = form.get('fecha_entrega') as string
		const abono = Number(form.get('abono') ?? 0)
		const nota = (form.get('nota') as string)?.trim()
		const usuario = await locals.getUsuario()

		const { error } = await locals.supabase
			.from('pedidos')
			.update({
				fecha_entrega: fechaEntrega || null,
				abono: Math.round(abono),
				nota: nota || null
			})
			.eq('id', pedidoId)

		if (error) return { error: 'Error al actualizar pedido' }

		await registrarCambio(
			locals.supabase,
			pedidoId,
			usuario?.id ?? null,
			`[Edición] Información del pedido actualizada`
		)

		return { success: true }
	}
}
