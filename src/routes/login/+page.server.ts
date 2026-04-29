import { fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions } from './$types'

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	})
}

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const form = await request.formData()
		const identificador = form.get('identificador')?.toString()?.trim() ?? ''
		const contrasena = form.get('contrasena')?.toString() ?? ''

		if (!identificador || !contrasena) {
			return fail(400, { error: 'Completa todos los campos' })
		}

		let email = identificador

		// Si no parece email, buscar por username
		if (!identificador.includes('@')) {
			const adminClient = getAdminClient()
			const { data: perfil } = await adminClient
				.from('perfiles')
				.select('id')
				.eq('username', identificador.toLowerCase())
				.single()

			if (!perfil) {
				return fail(400, { error: 'Usuario o contraseña incorrectos' })
			}

			// Obtener el email de auth.users
			const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(perfil.id)

			if (authErr || !authUser?.user?.email) {
				return fail(400, { error: 'Usuario o contraseña incorrectos' })
			}

			email = authUser.user.email
		}

		// Iniciar sesion con email y contraseña
		const { error } = await locals.supabase.auth.signInWithPassword({
			email: email.toLowerCase(),
			password: contrasena
		})

		if (error) {
			const errores: Record<string, string> = {
				'Invalid login credentials': 'Usuario o contraseña incorrectos',
				'Email not confirmed': 'Confirma tu email antes de entrar',
				'Too many requests': 'Demasiados intentos. Espera un momento'
			}
			return fail(400, { error: errores[error.message] ?? 'Error al iniciar sesion' })
		}

		return { success: true }
	}
}
