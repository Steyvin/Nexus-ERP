import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	const [{ data: clientes }, bancosRes] = await Promise.all([
		locals.supabase
			.from('clientes')
			.select('id, nombre, empresa')
			.eq('activo', true)
			.order('nombre'),
		rol === 'admin' || rol === 'finanzas'
			? locals.supabase
				.from('bancos')
				.select('id, nombre, tipo, color')
				.eq('activo', true)
				.order('nombre')
			: Promise.resolve({ data: [] as any[] })
	])

	return {
		clientes: clientes ?? [],
		bancos: bancosRes.data ?? [],
		rol
	}
}
