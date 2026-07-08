import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { consultarTareaMystic, type EstadoTarea } from '$lib/server/magnific'

// Polling de estado de una generación de imagen IA. El frontend llama este
// endpoint cada pocos segundos mientras estado === 'procesando'.
export const GET: RequestHandler = async ({ params, locals }) => {
	const usuario = await locals.getUsuario()
	if (!usuario) throw error(401, 'No autenticado')

	const supabase = locals.supabase

	const { data: gen, error: errGen } = await supabase
		.from('generaciones_ia')
		.select('*')
		.eq('id', params.generacionId)
		.eq('pedido_id', params.id)
		.single()

	if (errGen || !gen) throw error(404, 'Generación no encontrada')

	if (gen.estado !== 'procesando') {
		return json(gen)
	}

	// Se consultan una a la vez y con pausa entre cada una: el plan de Magnific
	// tiene un límite de solicitudes por segundo bastante estricto.
	const taskIds: string[] = gen.task_ids ?? []
	const estados: (EstadoTarea | null)[] = []
	for (let i = 0; i < taskIds.length; i++) {
		try {
			estados.push(await consultarTareaMystic(taskIds[i]))
		} catch (e) {
			console.error(`[Magnific] Error consultando task ${taskIds[i]}:`, e)
			estados.push(null)
		}
		if (i < taskIds.length - 1) await new Promise((r) => setTimeout(r, 800))
	}

	const completadas = estados.filter(
		(e): e is { estado: 'COMPLETED'; imagenUrl: string } => !!e && e.estado === 'COMPLETED' && !!e.imagenUrl
	)
	const fallidas = estados.filter((e) => !e || e.estado === 'FAILED')
	const enProgreso = estados.some((e) => e?.estado === 'CREATED' || e?.estado === 'IN_PROGRESS')

	// Aún faltan tareas por terminar: no tocamos la BD, solo informamos progreso
	if (enProgreso) {
		return json({ ...gen, progreso: { completadas: completadas.length, total: taskIds.length } })
	}

	// Todas las tareas terminaron (completadas o fallidas)
	if (completadas.length === 0) {
		const { data: actualizado } = await supabase
			.from('generaciones_ia')
			.update({ estado: 'error', error_mensaje: 'No se pudo generar ninguna variante' })
			.eq('id', gen.id)
			.select('*')
			.single()
		return json(actualizado ?? gen)
	}

	console.error(
		'[Magnific] Variantes completadas, imagenUrl recibida:',
		completadas.map((c) => c.imagenUrl?.slice(0, 100))
	)

	const resultados: string[] = []
	for (const { imagenUrl } of completadas) {
		try {
			resultados.push(await reSubirResultado(supabase, imagenUrl, gen.pedido_item_id))
		} catch (e) {
			console.error(`[Magnific] Error re-subiendo variante (origen: ${imagenUrl.slice(0, 80)}...):`, e)
		}
	}

	const estadoFinal = resultados.length > 0 ? 'completado' : 'error'
	const { data: actualizado } = await supabase
		.from('generaciones_ia')
		.update({
			estado: estadoFinal,
			resultados,
			error_mensaje:
				resultados.length === 0
					? 'No se pudo procesar ninguna variante'
					: fallidas.length > 0
						? `${fallidas.length} variante(s) fallaron`
						: null
		})
		.eq('id', gen.id)
		.select('*')
		.single()

	return json(actualizado ?? gen)
}

/** Descarga el resultado de Magnific (URL o base64 crudo) y lo re-sube a Storage propio. */
async function reSubirResultado(supabase: any, origen: string, itemId: string): Promise<string> {
	let buffer: Buffer
	let contentType = 'image/png'

	if (origen.startsWith('http')) {
		const res = await fetch(origen)
		if (!res.ok) throw new Error('No se pudo descargar el resultado de Magnific')
		contentType = res.headers.get('content-type') ?? contentType
		buffer = Buffer.from(await res.arrayBuffer())
	} else {
		buffer = Buffer.from(origen, 'base64')
	}

	const nombre = `montajes/${itemId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`
	const { error: errUpload } = await supabase.storage
		.from('imagenes')
		.upload(nombre, buffer, { contentType, upsert: false })

	if (errUpload) throw new Error(errUpload.message)

	const { data } = supabase.storage.from('imagenes').getPublicUrl(nombre)
	return data.publicUrl
}
