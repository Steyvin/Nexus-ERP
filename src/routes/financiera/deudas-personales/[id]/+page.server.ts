import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import {
	parseForm,
	esError,
	actualizarAcreedorPersonalSchema,
	eliminarAcreedorPersonalSchema,
	agregarCreditoDeudaPersonalSchema,
	eliminarCreditoDeudaPersonalSchema,
	agregarPagoDeudaPersonalSchema,
	eliminarPagoDeudaPersonalSchema
} from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ params, locals }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver deudas personales')
	}

	const { data: acreedor, error: err } = await locals.supabase
		.from('v_deudas_personales_saldo')
		.select('*')
		.eq('id', params.id)
		.single()

	if (err || !acreedor) throw error(404, 'Deuda no encontrada')

	const [creditosRes, pagosRes, bancosRes] = await Promise.all([
		locals.supabase
			.from('creditos_deuda_personal')
			.select('id, concepto, monto, fecha, created_at, registrado_por, perfiles:registrado_por(nombre)')
			.eq('acreedor_id', params.id)
			.order('fecha', { ascending: false })
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('movimientos_financieros')
			.select('id, concepto, monto, fecha, created_at, banco_id, registrado_por, perfiles:registrado_por(nombre), bancos:banco_id(id, nombre, color)')
			.eq('acreedor_personal_id', params.id)
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
		acreedor,
		creditos: creditosRes.data ?? [],
		pagos: pagosRes.data ?? [],
		bancos: bancosRes.data ?? [],
		rol
	}
}

export const actions: Actions = {
	// Actualizar acreedor
	actualizar: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos' })
		}

		const form = await request.formData()
		const datos = parseForm(actualizarAcreedorPersonalSchema, form)
		if (esError(datos)) return datos

		if (datos.acreedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { error: err } = await locals.supabase
			.from('acreedores_personales')
			.update({
				nombre: datos.nombre,
				tipo: datos.tipo,
				contacto: datos.contacto || null,
				notas: datos.notas || null,
				activo: datos.activo
			})
			.eq('id', datos.acreedor_id)

		if (err) return fail(500, { error: 'Error al actualizar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'actualizar_acreedor_personal',
			tabla: 'acreedores_personales',
			registro_id: datos.acreedor_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre, tipo: datos.tipo, activo: datos.activo }
		})

		return { success: true }
	},

	// Eliminar acreedor (solo si no tiene créditos ni pagos)
	eliminar: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || usuario.rol !== 'admin') {
			return fail(403, { error: 'Solo el administrador puede eliminar deudas' })
		}

		const form = await request.formData()
		const datos = parseForm(eliminarAcreedorPersonalSchema, form)
		if (esError(datos)) return datos

		const [{ count: countCreditos }, { count: countPagos }] = await Promise.all([
			locals.supabase
				.from('creditos_deuda_personal')
				.select('id', { count: 'exact', head: true })
				.eq('acreedor_id', datos.acreedor_id),
			locals.supabase
				.from('movimientos_financieros')
				.select('id', { count: 'exact', head: true })
				.eq('acreedor_personal_id', datos.acreedor_id)
		])

		if ((countCreditos ?? 0) > 0 || (countPagos ?? 0) > 0) {
			return fail(400, {
				error: 'No se puede eliminar: tiene créditos o pagos asociados. Desactívala en su lugar.'
			})
		}

		const { error: err } = await locals.supabase
			.from('acreedores_personales')
			.delete()
			.eq('id', datos.acreedor_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_acreedor_personal',
			tabla: 'acreedores_personales',
			registro_id: datos.acreedor_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		throw redirect(303, '/financiera/deudas-personales')
	},

	// Agregar crédito (aumenta la deuda)
	agregarCredito: async ({ request, params, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para registrar créditos' })
		}

		const form = await request.formData()
		const datos = parseForm(agregarCreditoDeudaPersonalSchema, form)
		if (esError(datos)) return datos

		if (datos.acreedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: credito, error: err } = await locals.supabase
			.from('creditos_deuda_personal')
			.insert({
				acreedor_id: datos.acreedor_id,
				concepto: datos.concepto,
				monto: Math.round(datos.monto),
				fecha: datos.fecha || new Date().toISOString().slice(0, 10),
				registrado_por: usuario.id
			})
			.select('id')
			.single()

		if (err || !credito) return fail(500, { error: 'Error al registrar crédito: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'agregar_credito_deuda_personal',
			tabla: 'creditos_deuda_personal',
			registro_id: credito.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { acreedor_id: datos.acreedor_id, concepto: datos.concepto, monto: datos.monto }
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
		const datos = parseForm(eliminarCreditoDeudaPersonalSchema, form)
		if (esError(datos)) return datos

		if (datos.acreedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: credito, error: errCredito } = await locals.supabase
			.from('creditos_deuda_personal')
			.select('id, monto, concepto, acreedor_id')
			.eq('id', datos.credito_id)
			.single()

		if (errCredito || !credito || credito.acreedor_id !== datos.acreedor_id) {
			return fail(404, { error: 'Crédito no encontrado' })
		}

		const { error: err } = await locals.supabase
			.from('creditos_deuda_personal')
			.delete()
			.eq('id', datos.credito_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_credito_deuda_personal',
			tabla: 'creditos_deuda_personal',
			registro_id: datos.credito_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { acreedor_id: datos.acreedor_id, monto: credito.monto, concepto: credito.concepto }
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
		const datos = parseForm(agregarPagoDeudaPersonalSchema, form)
		if (esError(datos)) return datos

		if (datos.acreedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const monto = Math.round(datos.monto)
		const concepto = datos.concepto?.trim() || 'Pago de deuda personal'

		const { data: movimiento, error: err } = await locals.supabase
			.from('movimientos_financieros')
			.insert({
				acreedor_personal_id: datos.acreedor_id,
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
			accion: 'agregar_pago_deuda_personal',
			tabla: 'movimientos_financieros',
			registro_id: movimiento.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { acreedor_id: datos.acreedor_id, monto, concepto, banco_id: datos.banco_id }
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
		const datos = parseForm(eliminarPagoDeudaPersonalSchema, form)
		if (esError(datos)) return datos

		if (datos.acreedor_id !== params.id) return fail(400, { error: 'ID inconsistente' })

		const { data: movimiento, error: errMov } = await locals.supabase
			.from('movimientos_financieros')
			.select('id, monto, concepto, acreedor_personal_id, tipo')
			.eq('id', datos.movimiento_id)
			.single()

		if (errMov || !movimiento || movimiento.tipo !== 'pago' || movimiento.acreedor_personal_id !== datos.acreedor_id) {
			return fail(404, { error: 'Pago no encontrado' })
		}

		const { error: err } = await locals.supabase
			.from('movimientos_financieros')
			.delete()
			.eq('id', datos.movimiento_id)

		if (err) return fail(500, { error: 'Error al eliminar: ' + err.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_pago_deuda_personal',
			tabla: 'movimientos_financieros',
			registro_id: datos.movimiento_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { acreedor_id: datos.acreedor_id, monto: movimiento.monto, concepto: movimiento.concepto }
		})

		return { success: true }
	}
}
