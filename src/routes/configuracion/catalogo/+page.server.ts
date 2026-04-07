import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const { data: catalogo } = await locals.supabase
		.from('catalogo_parametros')
		.select('*')
		.order('tipo')

	return { catalogo: catalogo ?? [] }
}
