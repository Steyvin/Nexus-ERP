import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const { data: clientes } = await locals.supabase
		.from('clientes')
		.select('id, nombre, empresa')
		.eq('activo', true)
		.order('nombre')

	return { clientes: clientes ?? [] }
}
