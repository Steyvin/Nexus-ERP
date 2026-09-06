import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import {
	parseForm,
	esError,
	actualizarProveedorSchema,
	eliminarProveedorSchema,
	agregarCreditoProveedorSchema,
	eliminarCreditoProveedorSchema,
	agregarPagoProveedorSchema,
	eliminarPagoProveedorSchema
} from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ params, locals }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver proveedores')
	}

	const { data: proveedor, error: err } = await locals.supabase
		.from('v_proveedores_saldo')
		.select('*')
		.eq('id', params.id)
		.single()

	if (err || !proveedor) throw error(404, 'Proveedor no encontrado')

	const [creditosRes, pagosRes, bancosRes] = await Promise.all([
		locals.supabase
			.from('creditos_proveedor')
			.select('id, concepto, monto, fecha, created_at, registrado_por, perfiles:registrado_por(nombre)')
			.eq('proveedor_id', params.id)
			.order('fecha', { ascending: false })
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('movimientos_financieros')
			.select('id, concepto, monto, fecha, created_at, banco_id, registrado_por, perfiles:registrado_por(nombre), bancos:banco_id(id, nombre, color)')
			.eq('proveedor_id', params.id)
			.eq('tipo', 'pago')
			.order('fecha', { ascending: false })
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('bancos')
			.select('id, nombre, tipo, color')
			.eq('activo', true)
			.order('nombre')
	])

	return {
		proveedor,
		creditos: creditosRes.data ?? [],
		pagos: pagosRes.data ?? [],
		bancos: bancosRes.data ?? [],
		rol
	}
}

export const actions: Actions = {
	// Actualizar proveedor
	actualizar: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarProveedorSchema, form)
		if (esError(datos)) return datos

		if (datos.proveedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { error: err } = await locals.supabase
			.from('proveedores')
			.update({
				nombre: datos.nombre,
				contacto: datos.contacto || null,
				email: datos.email || null,
				ciudad: datos.ciudad || null,
				notas: datos.notas || null,
				activo: datos.activo
			})
			.eq('id', datos.proveedor_id)

		if (err) return fail(500, { error: 'Error al actualizar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'actualizar_proveedor',
			tabla: 'proveedores',
			registro_id: datos.proveedor_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre, activo: datos.activo }
		})

		return { success: true }
	},

	// Eliminar proveedor (solo si no tiene créditos ni pagos)
	eliminar: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar proveedores' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarProveedorSchema, form)
		if (esError(datos)) return datos

		const [{ count: countCreditos }, { count: countPagos }] = await Promise.all([
			locals.supabase
				.from('creditos_proveedor')
				.select('id', { count: 'exact', head: true })
				.eq('proveedor_id', datos.proveedor_id),
			locals.supabase
				.from('movimientos_financieros')
				.select('id', { count: 'exact', head: true })
				.eq('proveedor_id', datos.proveedor_id)
		])

		if ((countCreditos ?? 0) > 0 || (countPagos ?? 0) > 0) {
			return fail(400, {
				error: 'No se puede eliminar: el proveedor tiene créditos o pagos asociados. Desactívalo en su lugar.'
			})
		}

		const { error: err } = await locals.supabase
			.from('proveedores')
			.delete()
			.eq('id', datos.proveedor_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_proveedor',
			tabla: 'proveedores',
			registro_id: datos.proveedor_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		throw redirect(303, '/financiera/proveedores')
	},

	// Agregar crédito (compra a crédito que aumenta la deuda)
	agregarCredito: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para registrar créditos' })
		}

		const form = await request.formData()
		const datos = parseForm(agregarCreditoProveedorSchema, form)
		if (esError(datos)) return datos

		if (datos.proveedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: credito, error: err } = await locals.supabase
			.from('creditos_proveedor')
			.insert({
				proveedor_id: datos.proveedor_id,
				concepto: datos.concepto,
				monto: Math.round(datos.monto),
				fecha: datos.fecha || new Date().toISOString().slice(0, 10),
				registrado_por: usuario.id
			})
			.select('id')
			.single()

		if (err || !credito) return fail(500, { error: 'Error al registrar crédito: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'agregar_credito_proveedor',
			tabla: 'creditos_proveedor',
			registro_id: credito.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { proveedor_id: datos.proveedor_id, concepto: datos.concepto, monto: datos.monto }
		})

		return { success: true }
	},

	// Eliminar crédito
	eliminarCredito: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para eliminar créditos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarCreditoProveedorSchema, form)
		if (esError(datos)) return datos

		if (datos.proveedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: credito, error: errCredito } = await locals.supabase
			.from('creditos_proveedor')
			.select('id, monto, concepto, proveedor_id')
			.eq('id', datos.credito_id)
			.single()

		if (errCredito || !credito || credito.proveedor_id !== datos.proveedor_id) {
			return fail(404, { error: 'Crédito no encontrado' })
		}

		const { error: err } = await locals.supabase
			.from('creditos_proveedor')
			.delete()
			.eq('id', datos.credito_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_credito_proveedor',
			tabla: 'creditos_proveedor',
			registro_id: datos.credito_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { proveedor_id: datos.proveedor_id, monto: credito.monto, concepto: credito.concepto }
		})

		return { success: true }
	},

	// Agregar pago (abono que reduce la deuda, sale de un banco)
	agregarPago: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para registrar pagos' })
		}

		const form = await request.formData()
		const datos = parseForm(agregarPagoProveedorSchema, form)
		if (esError(datos)) return datos

		if (datos.proveedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const monto = Math.round(datos.monto)
		const concepto = datos.concepto?.trim() || 'Pago a proveedor'

		const { data: movimiento, error: err } = await locals.supabase
			.from('movimientos_financieros')
			.insert({
				proveedor_id: datos.proveedor_id,
				banco_id: datos.banco_id,
				tipo: 'pago',
				concepto,
				monto,
				fecha: datos.fecha || new Date().toISOString().slice(0, 10),
				registrado_por: usuario.id
			})
			.select('id')
			.single()

		if (err || !movimiento) return fail(500, { error: 'Error al registrar pago: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'agregar_pago_proveedor',
			tabla: 'movimientos_financieros',
			registro_id: movimiento.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { proveedor_id: datos.proveedor_id, monto, concepto, banco_id: datos.banco_id }
		})

		return { success: true }
	},

	// Eliminar pago
	eliminarPago: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para eliminar pagos' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarPagoProveedorSchema, form)
		if (esError(datos)) return datos

		if (datos.proveedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: movimiento, error: errMov } = await locals.supabase
			.from('movimientos_financieros')
			.select('id, monto, concepto, proveedor_id, tipo')
			.eq('id', datos.movimiento_id)
			.single()

		if (errMov || !movimiento || movimiento.tipo !== 'pago' || movimiento.proveedor_id !== datos.proveedor_id) {
			return fail(404, { error: 'Pago no encontrado' })
		}

		const { error: err } = await locals.supabase
			.from('movimientos_financieros')
			.delete()
			.eq('id', datos.movimiento_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_pago_proveedor',
			tabla: 'movimientos_financieros',
			registro_id: datos.movimiento_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { proveedor_id: datos.proveedor_id, monto: movimiento.monto, concepto: movimiento.concepto }
		})

		return { success: true }
	}
}
