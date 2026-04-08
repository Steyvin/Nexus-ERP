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
	// ── Invitar nuevo usuario por email ──────────────────────────────────────
	invitarUsuario: async ({ request, locals }) => {
		const usuario = await locals.getUsuario()
		if (usuario?.rol !== 'admin') return fail(403, { error: 'Sin permisos' })

		const form = await request.formData()
		const email  = (form.get('email')  as string)?.trim().toLowerCase()
		const nombre = (form.get('nombre') as string)?.trim()
		const rol    = form.get('rol') as Rol

		if (!email || !nombre || !rol) {
			return fail(400, { error: 'Todos los campos son obligatorios' })
		}

		const supabaseAdmin = getAdminClient()

		// inviteUserByEmail envía el email de invitación.
		// Los metadatos (nombre, rol) los usa el trigger on_auth_user_created
		// para crear automáticamente el perfil con el rol correcto.
		const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
			data: { nombre, rol }
		})

		if (error) {
			const mensaje =
				error.message.includes('already been registered')
					? 'Ese email ya está registrado en el sistema'
					: error.message
			return fail(400, { error: mensaje })
		}

		return { success: true, mensaje: `Invitación enviada a ${email}` }
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
	}
}
