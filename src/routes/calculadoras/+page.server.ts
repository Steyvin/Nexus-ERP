import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const { data: catalogo } = await locals.supabase
		.from('catalogo_parametros')
		.select('*')
		.eq('activo', true)
		.order('tipo')

	// Indexar por tipo para acceso directo
	const parametros: Record<string, Record<string, unknown>> = {}
	for (const item of catalogo ?? []) {
		parametros[item.tipo] = item.parametros as Record<string, unknown>
	}

	return { parametros }
}
