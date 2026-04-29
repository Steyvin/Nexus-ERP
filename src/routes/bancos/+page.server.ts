import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, crearBancoSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver bancos')
	}

	const { data: bancos } = await locals.supabase
		.from('v_bancos_saldo')
		.select('*')
		.order('activo', { ascending: false })
		.order('nombre')

	return {
		bancos: bancos ?? [],
		rol
	}
}

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para crear bancos' })
		}

		const form = await request.formData()
		const datos = parseForm(crearBancoSchema, form)
		if (esError(datos)) return datos

		const { data: banco, error: err } = await locals.supabase
			.from('bancos')
			.insert({
				nombre: datos.nombre,
				tipo: datos.tipo,
				numero_cuenta: datos.numero_cuenta || null,
				saldo_inicial: Math.round(datos.saldo_inicial),
				color: datos.color,
				notas: datos.notas || null
			})
			.select('id')
			.single()

		if (err || !banco) return fail(500, { error: 'Error al crear banco: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'crear_banco',
			tabla: 'bancos',
			registro_id: banco.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre, tipo: datos.tipo, saldo_inicial: datos.saldo_inicial }
		})

		throw redirect(303, `/bancos/${banco.id}`)
	}
}
