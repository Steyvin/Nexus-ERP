import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, crearAcreedorPersonalSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver deudas personales')
	}

	const busqueda = url.searchParams.get('q') ?? ''
	const filtroActivo = url.searchParams.get('activo') // 'true' | 'false' | null (todos)
	const filtroTipo = url.searchParams.get('tipo') // 'personal' | 'negocio' | null (todos)

	let query = locals.supabase
		.from('v_deudas_personales_saldo')
		.select('*')
		.order('activo', { ascending: false })
		.order('nombre')

	if (busqueda) {
		query = query.or(`nombre.ilike.%${busqueda}%,contacto.ilike.%${busqueda}%`)
	}

	if (filtroActivo === 'true') query = query.eq('activo', true)
	else if (filtroActivo === 'false') query = query.eq('activo', false)

	if (filtroTipo === 'personal' || filtroTipo === 'negocio') query = query.eq('tipo', filtroTipo)

	const { data: acreedores } = await query

	const totalPersonal = (acreedores ?? [])
		.filter((a: any) => a.tipo === 'personal')
		.reduce((s: number, a: any) => s + Math.max(0, Number(a.deuda ?? 0)), 0)

	const totalNegocio = (acreedores ?? [])
		.filter((a: any) => a.tipo === 'negocio')
		.reduce((s: number, a: any) => s + Math.max(0, Number(a.deuda ?? 0)), 0)

	return {
		acreedores: acreedores ?? [],
		totalPersonal,
		totalNegocio,
		busqueda,
		filtroActivo,
		filtroTipo,
		rol
	}
}

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para crear deudas' })
		}

		const form = await request.formData()
		const datos = parseForm(crearAcreedorPersonalSchema, form)
		if (esError(datos)) return datos

		const { data: acreedor, error: err } = await locals.supabase
			.from('acreedores_personales')
			.insert({
				nombre: datos.nombre,
				tipo: datos.tipo,
				contacto: datos.contacto || null,
				notas: datos.notas || null,
				creado_por: usuario.id
			})
			.select('id')
			.single()

		if (err || !acreedor) return fail(500, { error: 'Error al crear: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'crear_acreedor_personal',
			tabla: 'acreedores_personales',
			registro_id: acreedor.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre, tipo: datos.tipo }
		})

		throw redirect(303, `/financiera/deudas-personales/${acreedor.id}`)
	}
}
