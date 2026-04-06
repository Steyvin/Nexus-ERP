import type { LayoutServerLoad } from './$types'

/**
 * Se ejecuta en el servidor para CADA request.
 * Carga la sesión y el perfil del usuario y los pasa a $page.data.
 * Todos los componentes hijos pueden acceder a `data.session` y `data.usuario`.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const [session, usuario] = await Promise.all([
		locals.getSession(),
		locals.getUsuario()
	])

	return {
		session,
		usuario
	}
}
