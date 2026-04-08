import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()

	if (!usuario || usuario.rol !== 'admin') {
		redirect(303, '/dashboard')
	}

	const { data: catalogo } = await locals.supabase
		.from('catalogo_parametros')
		.select('*')
		.order('tipo')

	return { catalogo: catalogo ?? [] }
}
