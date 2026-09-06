import { error, fail, redirect } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, crearProveedorSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver proveedores')
	}

	const busqueda = url.searchParams.get('q') ?? ''
	const filtroActivo = url.searchParams.get('activo') // 'true' | 'false' | null (todos)

	let query = locals.supabase
		.from('v_proveedores_saldo')
		.select('*')
		.order('activo', { ascending: false })
		.order('nombre')

	if (busqueda) {
		query = query.or(`nombre.ilike.%${busqueda}%,email.ilike.%${busqueda}%,contacto.ilike.%${busqueda}%`)
	}

	if (filtroActivo === 'true') query = query.eq('activo', true)
	else if (filtroActivo === 'false') query = query.eq('activo', false)

	const { data: proveedores } = await query

	return {
		proveedores: proveedores ?? [],
		busqueda,
		filtroActivo,
		rol
	}
}

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (!usuario || (usuario.rol !== 'admin' && usuario.rol !== 'finanzas')) {
			return fail(403, { error: 'Sin permisos para crear proveedores' })
		}

		const form = await request.formData()
		const datos = parseForm(crearProveedorSchema, form)
		if (esError(datos)) return datos

		const { data: proveedor, error: err } = await locals.supabase
			.from('proveedores')
			.insert({
				nombre: datos.nombre,
				contacto: datos.contacto || null,
				email: datos.email || null,
				ciudad: datos.ciudad || null,
				notas: datos.notas || null,
				creado_por: usuario.id
			})
			.select('id')
			.single()

		if (err || !proveedor) return fail(500, { error: 'Error al crear proveedor: ' + (err?.message ?? '') })

		await registrarAudit(locals.supabase, {
			accion: 'crear_proveedor',
			tabla: 'proveedores',
			registro_id: proveedor.id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nombre: datos.nombre }
		})

		throw redirect(303, `/financiera/proveedores/${proveedor.id}`)
	}
}
