import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.getUsuario()
	const rol = usuario?.rol ?? null

	if (rol !== 'admin' && rol !== 'finanzas') {
		throw error(403, 'Sin permisos para ver la sección financiera')
	}

	const [clientesRes, proveedoresRes, deudasPersonalesRes, bancosRes] = await Promise.all([
		locals.supabase
			.from('clientes')
			.select('id, nombre, contacto, pedidos(precio_total, abono)')
			.eq('activo', true),
		locals.supabase
			.from('v_proveedores_saldo')
			.select('*')
			.eq('activo', true)
			.order('nombre'),
		locals.supabase
			.from('v_deudas_personales_saldo')
			.select('*')
			.eq('activo', true)
			.order('nombre'),
		locals.supabase
			.from('v_bancos_saldo')
			.select('saldo')
			.eq('activo', true)
	])

	const clientesConDeuda = (clientesRes.data ?? [])
		.map((c: any) => {
			const ped = c.pedidos ?? []
			const totalComprado = ped.reduce((s: number, p: any) => s + Number(p.precio_total || 0), 0)
			const abonos = ped.reduce((s: number, p: any) => s + Number(p.abono || 0), 0)
			return {
				id: c.id,
				nombre: c.nombre,
				contacto: c.contacto,
				deuda: totalComprado - abonos
			}
		})
		.filter((c: any) => c.deuda > 0)
		.sort((a: any, b: any) => b.deuda - a.deuda)

	const proveedoresConDeuda = (proveedoresRes.data ?? [])
		.filter((p: any) => Number(p.deuda) > 0)
		.sort((a: any, b: any) => Number(b.deuda) - Number(a.deuda))

	const deudasPersonalesConDeuda = (deudasPersonalesRes.data ?? [])
		.filter((d: any) => Number(d.deuda) > 0)
		.sort((a: any, b: any) => Number(b.deuda) - Number(a.deuda))

	const totalPorCobrar = clientesConDeuda.reduce((s: number, c: any) => s + c.deuda, 0)
	const totalPorPagar = proveedoresConDeuda.reduce((s: number, p: any) => s + Number(p.deuda), 0)
	const totalDeudaPersonal = deudasPersonalesConDeuda
		.filter((d: any) => d.tipo === 'personal')
		.reduce((s: number, d: any) => s + Number(d.deuda), 0)
	const totalDeudaNegocio = deudasPersonalesConDeuda
		.filter((d: any) => d.tipo === 'negocio')
		.reduce((s: number, d: any) => s + Number(d.deuda), 0)

	const totalDisponible = (bancosRes.data ?? []).reduce((s: number, b: any) => s + Number(b.saldo || 0), 0)

	return {
		clientesConDeuda,
		proveedoresConDeuda,
		deudasPersonalesConDeuda,
		totalPorCobrar,
		totalPorPagar,
		totalDeudaPersonal,
		totalDeudaNegocio,
		totalDisponible,
		rol
	}
}
