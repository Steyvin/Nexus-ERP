import { error, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, actualizarCompraSchema, crearProveedorSchema } from '$lib/utils/validate'

const ROLES_PERMITIDOS = ['admin', 'finanzas', 'fabricador']

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (!rol || !ROLES_PERMITIDOS.includes(rol)) {
		throw error(403, 'Sin acceso a la vista de material')
	}

	// Por defecto solo lo que todavía no llega; `todo=1` incluye lo recibido
	const verTodo = url.searchParams.get('todo') === '1'

	let query = supabase
		.from('pedido_compras')
		.select(
			`id, material, cantidad, estado, costo_real, fecha_pedido, fecha_estimada, fecha_recibido, notas,
			 pedido_id,
			 proveedores(id, nombre, contacto, materiales),
			 pedidos!inner(id, estado, fecha_entrega, fecha_entregado, prioridad, clientes!inner(nombre))`
		)
		.order('fecha_estimada', { ascending: true, nullsFirst: false })

	if (!verTodo) query = query.neq('estado', 'recibido')

	const { data: compras, error: errCompras } = await query

	if (errCompras) {
		console.error('[material.load] Error al consultar compras:', errCompras)
	}

	const { data: proveedores } = await supabase
		.from('proveedores')
		.select('id, nombre, contacto, ciudad, materiales')
		.eq('activo', true)
		.order('nombre')

	return {
		compras: compras ?? [],
		proveedores: proveedores ?? [],
		verTodo,
		rol,
		errorCarga: errCompras?.message ?? null
	}
}

export const actions: Actions = {
	// Cambiar estado de una compra sin salir de la vista global
	actualizarCompra: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || !ROLES_PERMITIDOS.includes(usuario.rol)) {
			return fail(403, { error: 'Sin permisos para actualizar material' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarCompraSchema, form)
		if (esError(datos)) return datos

		const cambios: Record<string, unknown> = { estado: datos.estado }
		if (datos.estado === 'pedido') cambios.fecha_pedido = new Date().toISOString().slice(0, 10)
		if (datos.estado === 'recibido') cambios.fecha_recibido = new Date().toISOString().slice(0, 10)
		if (datos.estado === 'por_pedir') {
			cambios.fecha_pedido = null
			cambios.fecha_recibido = null
		}
		if (datos.fecha_estimada) cambios.fecha_estimada = datos.fecha_estimada
		if (datos.costo_real !== undefined && (usuario.rol === 'admin' || usuario.rol === 'finanzas')) {
			cambios.costo_real = Math.round(datos.costo_real)
		}

		const { error: errUpdate } = await locals.supabase
			.from('pedido_compras')
			.update(cambios)
			.eq('id', datos.compra_id)
			.eq('pedido_id', datos.pedido_id)

		if (errUpdate) return fail(500, { error: 'Error al actualizar: ' + errUpdate.message })
		return { success: true }
	},

	// Crear proveedor (admin o finanzas)
	crearProveedor: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para crear proveedores' })
		}

		const form = await request.formData()
		const datos = parseForm(crearProveedorSchema, form)
		if (esError(datos)) return datos

		const { error: errInsert } = await locals.supabase.from('proveedores').insert({
			nombre: datos.nombre,
			contacto: datos.contacto || null,
			ciudad: datos.ciudad || null,
			materiales: datos.materiales || null,
			notas: datos.notas || null
		})

		if (errInsert) return fail(500, { error: 'Error al crear proveedor: ' + errInsert.message })
		return { success: true }
	}
}
