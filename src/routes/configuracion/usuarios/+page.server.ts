import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'
import { parseForm, esError, crearUsuarioSchema, cambiarRolSchema, toggleActivoSchema, eliminarUsuarioSchema, cambiarClaveSchema } from '$lib/utils/validate'
import { registrarAudit } from '$lib/utils/audit'

// Cliente admin con service_role (solo para operaciones de auth en el servidor)
function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	})
}

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()

	// Solo admin
	if (!usuario || usuario.rol !== 'admin') {
		redirect(303, '/dashboard')
	}

	const supabaseAdmin = getAdminClient()

	const [perfilesRes, authUsersRes] = await Promise.all([
		locals.supabase
			.from('perfiles')
			.select('id, nombre, rol, activo, ultimo_acceso, created_at')
			.order('created_at', { ascending: true }),

		supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
	])

	const perfiles = perfilesRes.data ?? []
	const authUsers = authUsersRes.data?.users ?? []

	// Combinar email de auth.users con cada perfil
	const emailPorId = Object.fromEntries(authUsers.map((u) => [u.id, u.email ?? '']))

	const usuarios = perfiles.map((p) => ({
		...p,
		email: emailPorId[p.id] ?? ''
	}))

	return { usuarios, usuarioActualId: usuario.id }
}

export const actions: Actions = {
	// ── Crear nuevo usuario con correo y clave ──────────────────────────────
	crearUsuario: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const datos = parseForm(crearUsuarioSchema, form)
		if (esError(datos)) return datos

		const supabaseAdmin = getAdminClient()

		// Crear usuario con contraseña asignada
		const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
			email: datos.email,
			password: datos.clave,
			email_confirm: true,
			user_metadata: { nombre: datos.nombre, rol: datos.rol }
		})

		if (error) {
			const mensaje =
				error.message.includes('already been registered')
					? 'Ese email ya está registrado en el sistema'
					: error.message
			return fail(400, { error: mensaje })
		}

		// Actualizar el rol en perfiles
		if (newUser?.user) {
			const { error: updateError } = await supabaseAdmin
				.from('perfiles')
				.update({ rol: datos.rol })
				.eq('id', newUser.user.id)

			if (updateError) {
				console.error('Error al asignar rol:', updateError)
				return fail(500, {
					error: `Usuario creado pero no se pudo asignar el rol "${datos.rol}": ${updateError.message}`
				})
			}
		}

		await registrarAudit(locals.supabase, {
			accion: 'crear_usuario',
			tabla: 'perfiles',
			registro_id: newUser?.user?.id ?? '',
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { email: datos.email, nombre: datos.nombre, rol: datos.rol }
		})

		return { success: true, mensaje: `Usuario ${datos.nombre} creado exitosamente` }
	},

	// ── Cambiar rol de un usuario ─────────────────────────────────────────────
	cambiarRol: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const datos = parseForm(cambiarRolSchema, form)
		if (esError(datos)) return datos

		if (datos.user_id === usuario.id) {
			return fail(400, { error: 'No puedes cambiar tu propio rol' })
		}

		const supabaseAdmin = getAdminClient()
		const { error } = await supabaseAdmin
			.from('perfiles')
			.update({ rol: datos.rol })
			.eq('id', datos.user_id)

		if (error) return fail(500, { error: `Error al actualizar rol: ${error.message}` })

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_rol',
			tabla: 'perfiles',
			registro_id: datos.user_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { nuevo_rol: datos.rol }
		})

		return { success: true }
	},

	// ── Activar / desactivar acceso ───────────────────────────────────────────
	toggleActivo: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const datos = parseForm(toggleActivoSchema, form)
		if (esError(datos)) return datos

		if (datos.user_id === usuario.id) {
			return fail(400, { error: 'No puedes desactivarte a ti mismo' })
		}

		const nuevoEstado = datos.activo !== 'true'

		const { error } = await locals.supabase
			.from('perfiles')
			.update({ activo: nuevoEstado })
			.eq('id', datos.user_id)

		if (error) return fail(500, { error: 'Error al actualizar estado' })

		await registrarAudit(locals.supabase, {
			accion: 'toggle_activo',
			tabla: 'perfiles',
			registro_id: datos.user_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre,
			detalles: { activo: nuevoEstado }
		})

		return { success: true }
	},

	// ── Eliminar usuario ──────────────────────────────────────────────────────
	eliminarUsuario: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const datos = parseForm(eliminarUsuarioSchema, form)
		if (esError(datos)) return datos

		if (datos.user_id === usuario.id) {
			return fail(400, { error: 'No puedes eliminarte a ti mismo' })
		}

		const supabaseAdmin = getAdminClient()

		// Eliminar perfil de la base de datos
		await supabaseAdmin
			.from('perfiles')
			.delete()
			.eq('id', datos.user_id)

		// Eliminar usuario de auth
		const { error } = await supabaseAdmin.auth.admin.deleteUser(datos.user_id)

		if (error) return fail(500, { error: 'Error al eliminar usuario: ' + error.message })

		await registrarAudit(locals.supabase, {
			accion: 'eliminar_usuario',
			tabla: 'perfiles',
			registro_id: datos.user_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		return { success: true }
	},

	// ── Cambiar contraseña de un usuario ───────────────────────────────────────
	cambiarClave: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const datos = parseForm(cambiarClaveSchema, form)
		if (esError(datos)) return datos

		const supabaseAdmin = getAdminClient()

		// Actualizar en Supabase Auth
		const { error } = await supabaseAdmin.auth.admin.updateUserById(datos.user_id, {
			password: datos.nueva_clave
		})

		if (error) return fail(500, { error: 'Error al cambiar contraseña: ' + error.message })

		await registrarAudit(locals.supabase, {
			accion: 'cambiar_clave',
			tabla: 'perfiles',
			registro_id: datos.user_id,
			usuario_id: usuario.id,
			usuario_nombre: usuario.nombre
		})

		return { success: true }
	}
}
