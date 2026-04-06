import { goto } from '$app/navigation'
import { supabase } from '$lib/supabase'
import { session, usuario } from '$lib/stores/auth'
import { mostrarToast } from '$lib/stores/ui'

/**
 * Cierra la sesión del usuario actual.
 * Limpia los stores y redirige a /login.
 */
export async function cerrarSesion(): Promise<void> {
	const { error } = await supabase.auth.signOut()

	if (error) {
		mostrarToast('Error al cerrar sesión', 'error')
		return
	}

	// Limpiar stores locales
	session.set(null)
	usuario.set(null)

	await goto('/login')
}

/**
 * Inicia sesión con email y contraseña.
 * Retorna null si fue exitoso o el mensaje de error.
 */
export async function iniciarSesion(
	email: string,
	contrasena: string
): Promise<string | null> {
	const { error } = await supabase.auth.signInWithPassword({
		email: email.trim().toLowerCase(),
		password: contrasena
	})

	if (error) {
		// Traducir errores comunes de Supabase al español
		const errores: Record<string, string> = {
			'Invalid login credentials': 'Email o contraseña incorrectos',
			'Email not confirmed':       'Confirma tu email antes de entrar',
			'Too many requests':         'Demasiados intentos. Espera un momento'
		}
		return errores[error.message] ?? 'Error al iniciar sesión'
	}

	return null
}
