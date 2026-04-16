import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'
import type { Rol } from '$lib/types'

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
			.select('id, nombre, rol, activo, ultimo_acceso, created_at, clave_texto')
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
		const email  = (form.get('email')  as string)?.trim().toLowerCase()
		const nombre = (form.get('nombre') as string)?.trim()
		const rol    = form.get('rol') as Rol
		const clave  = (form.get('clave')  as string)

		if (!email || !nombre || !rol || !clave) {
			return fail(400, { error: 'Todos los campos son obligatorios' })
		}

		if (clave.length < 6) {
			return fail(400, { error: 'La clave debe tener al menos 6 caracteres' })
		}

		const supabaseAdmin = getAdminClient()

		// Crear usuario con contraseña asignada
		// Solo pasamos 'nombre' en metadata para que el trigger handle_new_user
		// pueda crear el perfil sin problemas. El rol lo actualizamos después.
		const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
			email,
			password: clave,
			email_confirm: true,
			user_metadata: { nombre }
		})

		if (error) {
			const mensaje =
				error.message.includes('already been registered')
					? 'Ese email ya está registrado en el sistema'
					: error.message
			return fail(400, { error: mensaje })
		}

		// Actualizar el rol y guardar la clave en texto plano
		if (newUser?.user) {
			await supabaseAdmin
				.from('perfiles')
				.update({ rol, clave_texto: clave })
				.eq('id', newUser.user.id)
		}

		return { success: true, mensaje: `Usuario ${nombre} creado exitosamente` }
	},

	// ── Cambiar rol de un usuario ─────────────────────────────────────────────
	cambiarRol: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form   = await request.formData()
		const userId = form.get('user_id') as string
		const rol    = form.get('rol') as Rol

		if (userId === usuario.id) {
			return fail(400, { error: 'No puedes cambiar tu propio rol' })
		}

		const { error } = await locals.supabase
			.from('perfiles')
			.update({ rol })
			.eq('id', userId)

		if (error) return fail(500, { error: 'Error al actualizar rol' })
		return { success: true }
	},

	// ── Activar / desactivar acceso ───────────────────────────────────────────
	toggleActivo: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form    = await request.formData()
		const userId  = form.get('user_id') as string
		const activo  = form.get('activo') === 'true'

		if (userId === usuario.id) {
			return fail(400, { error: 'No puedes desactivarte a ti mismo' })
		}

		const { error } = await locals.supabase
			.from('perfiles')
			.update({ activo: !activo })
			.eq('id', userId)

		if (error) return fail(500, { error: 'Error al actualizar estado' })
		return { success: true }
	},

	// ── Eliminar usuario ──────────────────────────────────────────────────────
	eliminarUsuario: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form   = await request.formData()
		const userId = form.get('user_id') as string

		if (userId === usuario.id) {
			return fail(400, { error: 'No puedes eliminarte a ti mismo' })
		}

		const supabaseAdmin = getAdminClient()

		// Eliminar perfil de la base de datos
		await supabaseAdmin
			.from('perfiles')
			.delete()
			.eq('id', userId)

		// Eliminar usuario de auth
		const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

		if (error) return fail(500, { error: 'Error al eliminar usuario: ' + error.message })
		return { success: true }
	},

	// ── Cambiar contraseña de un usuario ───────────────────────────────────────
	cambiarClave: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form      = await request.formData()
		const userId    = form.get('user_id') as string
		const nuevaClave = (form.get('nueva_clave') as string)

		if (!nuevaClave || nuevaClave.length < 6) {
			return fail(400, { error: 'La clave debe tener al menos 6 caracteres' })
		}

		const supabaseAdmin = getAdminClient()

		// Actualizar en Supabase Auth
		const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
			password: nuevaClave
		})

		if (error) return fail(500, { error: 'Error al cambiar contraseña: ' + error.message })

		// Actualizar clave en texto plano en perfiles
		await supabaseAdmin
			.from('perfiles')
			.update({ clave_texto: nuevaClave })
			.eq('id', userId)

		return { success: true }
	}
}
