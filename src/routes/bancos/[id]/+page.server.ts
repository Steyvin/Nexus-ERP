import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import {
	parseForm,
	esError,
	actualizarBancoSchema,
	eliminarBancoSchema,
	agregarMovimientoBancoSchema,
	eliminarMovimientoBancoSchema
} from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver bancos')
	}

	const { data: banco, error: err } = await locals.supabase
		.from('v_bancos_saldo')
		.select('*')
		.eq('id', params.id)
		.single()

	if (err || !banco) throw error(404, 'Banco no encontrado')

	// Filtro de tipo (opcional)
	const filtroTipo = url.searchParams.get('tipo') ?? ''

	let query = locals.supabase
		.from('movimientos_financieros')
		.select(`
			id, tipo, concepto, monto, fecha, created_at, pedido_id, registrado_por,
			perfiles:registrado_por(nombre),
			pedidos:pedido_id(id, clientes(nombre))
		`)
		.eq('banco_id', params.id)
		.order('fecha', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(200)

	if (filtroTipo && filtroTipo !== 'todos') {
		query = query.eq('tipo', filtroTipo)
	}

	const { data: movimientos } = await query

	return {
		banco,
		movimientos: movimientos ?? [],
		filtroTipo: filtroTipo || 'todos',
		rol
	}
}

export const actions: Actions = {
	// Actualizar banco
	actualizar: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarBancoSchema, form)
		if (esError(datos)) return datos

		if (datos.banco_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { error: err } = await locals.supabase
			.from('bancos')
			.update({
				nombre: datos.nombre,
				tipo: datos.tipo,
				numero_cuenta: datos.numero_cuenta || null,
				color: datos.color,
				notas: datos.notas || null,
				activo: datos.activo
			})
			.eq('id', datos.banco_id)

		if (err) return fail(500, { error: 'Error al actualizar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'actualizar_banco',
			tabla: 'bancos',
			registro_id: datos.banco_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre, tipo: datos.tipo, activo: datos.activo }
		})

		return { success: true }
	},

	// Eliminar banco (solo si no tiene movimientos)
	eliminar: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar bancos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarBancoSchema, form)
		if (esError(datos)) return datos

		// Chequear si tiene movimientos
		const { count } = await locals.supabase
			.from('movimientos_financieros')
			.select('id', { count: 'exact', head: true })
			.eq('banco_id', datos.banco_id)

		if ((count ?? 0) > 0) {
			return fail(400, {
				error: 'No se puede eliminar: el banco tiene movimientos asociados. Desactívalo en su lugar.'
			})
		}

		const { error: err } = await locals.supabase
			.from('bancos')
			.delete()
			.eq('id', datos.banco_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_banco',
			tabla: 'bancos',
			registro_id: datos.banco_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		throw redirect(303, '/bancos')
	},

	// Agregar movimiento manual (ingreso, gasto, compra, pago, ajuste)
	agregarMovimiento: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos' })
		}

		const form = await request.formData()
		const datos = parseForm(agregarMovimientoBancoSchema, form)
		if (esError(datos)) return datos

		if (datos.banco_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { error: err } = await locals.supabase
			.from('movimientos_financieros')
			.insert({
				banco_id: datos.banco_id,
				tipo: datos.tipo,
				concepto: datos.concepto,
				monto: Math.round(datos.monto),
				fecha: datos.fecha || new Date().toISOString().slice(0, 10),
				registrado_por: usuario.id
			})

		if (err) return fail(500, { error: 'Error al registrar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'agregar_movimiento_banco',
			tabla: 'movimientos_financieros',
			registro_id: datos.banco_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { tipo: datos.tipo, concepto: datos.concepto, monto: datos.monto }
		})

		return { success: true }
	},

	// Eliminar un movimiento del banco (no asociado a pedido)
	eliminarMovimiento: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar movimientos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarMovimientoBancoSchema, form)
		if (esError(datos)) return datos

		// Cargar el movimiento para validar
		const { data: mov, error: errMov } = await locals.supabase
			.from('movimientos_financieros')
			.select('id, tipo, monto, concepto, banco_id, pedido_id')
			.eq('id', datos.movimiento_id)
			.single()

		if (errMov || !mov) return fail(404, { error: 'Movimiento no encontrado' })
		if (mov.banco_id !== datos.banco_id) return fail(400, { error: 'Movimiento no pertenece al banco' })

		// Si está asociado a un pedido como abono, no permitir eliminar desde aquí
		if (mov.pedido_id && mov.tipo === 'abono') {
			return fail(400, {
				error: 'Este abono está asociado a un pedido. Elimínalo desde el detalle del pedido.'
			})
		}

		const { error: err } = await locals.supabase
			.from('movimientos_financieros')
			.delete()
			.eq('id', datos.movimiento_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_movimiento_banco',
			tabla: 'movimientos_financieros',
			registro_id: datos.banco_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { movimiento_id: datos.movimiento_id, tipo: mov.tipo, monto: mov.monto }
		})

		return { success: true }
	}
}
