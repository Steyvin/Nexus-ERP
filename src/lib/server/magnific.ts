import { MAGNIFIC_API_KEY } from '$env/static/private'

// Cliente del endpoint Mystic de Magnific (antes Freepik) para generar montajes
// de fachada. Server-only: nunca importar este módulo desde código de cliente.

const BASE_URL = 'https://api.magnific.com'

const PROMPT_BASE =
	'Fotografía realista de la fachada de un local comercial, mostrando cómo quedaría ' +
	'instalado un aviso/rótulo publicitario sobre ella. Mantén la arquitectura, perspectiva, ' +
	'iluminación y ángulo de cámara de la foto original de la fachada. El diseño del aviso ' +
	'(forma, colores, tipografía) debe coincidir con el de la imagen de referencia de estilo. ' +
	'El resultado debe verse como una foto real, no como un dibujo o render 3D.'

/** Arma el prompt fijo + contexto del item + texto libre del usuario. */
export function construirPromptMontaje(
	item: { tipo_label: string; descripcion: string },
	descripcionUsuario?: string
): string {
	const partes = [
		PROMPT_BASE,
		`Tipo de producto: ${item.tipo_label}.`,
		`Detalle del pedido: ${item.descripcion}.`
	]
	if (descripcionUsuario?.trim()) {
		partes.push(descripcionUsuario.trim())
	}
	return partes.join(' ')
}

function esperar(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/** fetch con reintento y backoff cuando Magnific responde 429 (rate limit). */
async function fetchConReintento(url: string, init: RequestInit, intentos = 4): Promise<Response> {
	for (let intento = 0; intento < intentos; intento++) {
		const res = await fetch(url, init)
		if (res.status !== 429) return res
		if (intento === intentos - 1) return res

		const retryAfter = Number(res.headers.get('retry-after'))
		const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** intento
		console.error(`[Magnific] 429 rate limit, reintentando en ${espera}ms (intento ${intento + 1}/${intentos})`)
		await esperar(espera)
	}
	// Inalcanzable: el bucle siempre retorna en la última iteración
	return fetch(url, init)
}

/** Descarga una imagen pública y la convierte a base64 (sin el prefijo data:). */
export async function urlABase64(url: string): Promise<string> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`No se pudo descargar la imagen de referencia: ${url}`)
	const buffer = await res.arrayBuffer()
	return Buffer.from(buffer).toString('base64')
}

interface CrearTareaParams {
	prompt: string
	structureReferenceBase64: string
	styleReferenceBase64: string
}

/** Dispara una generación en Mystic y devuelve el task_id. */
async function crearTareaMystic({
	prompt,
	structureReferenceBase64,
	styleReferenceBase64
}: CrearTareaParams): Promise<string> {
	const res = await fetchConReintento(`${BASE_URL}/v1/ai/mystic`, {
		method: 'POST',
		headers: {
			'x-magnific-api-key': MAGNIFIC_API_KEY,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			prompt,
			structure_reference: structureReferenceBase64,
			structure_strength: 65,
			style_reference: styleReferenceBase64,
			adherence: 60
		})
	})

	if (!res.ok) {
		const texto = await res.text().catch(() => '')
		throw new Error(`Error de Magnific API (${res.status}): ${texto || res.statusText}`)
	}

	const data = await res.json()
	const taskId = data.task_id ?? data.data?.task_id ?? data.id ?? data.data?.id
	if (!taskId) {
		console.error('[Magnific] Respuesta sin task_id:', JSON.stringify(data))
		throw new Error('Magnific no devolvió task_id')
	}
	return taskId as string
}

/** Dispara N generaciones, una a la vez (Magnific limita solicitudes concurrentes), y devuelve sus task_ids. */
export async function crearMontajesMystic(
	params: CrearTareaParams,
	numVariantes: number
): Promise<string[]> {
	const taskIds: string[] = []
	for (let i = 0; i < numVariantes; i++) {
		taskIds.push(await crearTareaMystic(params))
		if (i < numVariantes - 1) await esperar(500)
	}
	return taskIds
}

export interface EstadoTarea {
	estado: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
	imagenUrl: string | null
}

/** Consulta el estado de una tarea Mystic por su task_id. */
export async function consultarTareaMystic(taskId: string): Promise<EstadoTarea> {
	const res = await fetchConReintento(`${BASE_URL}/v1/ai/mystic/${taskId}`, {
		headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY }
	})

	if (!res.ok) {
		const texto = await res.text().catch(() => '')
		throw new Error(`Error consultando tarea Magnific (${res.status}): ${texto || res.statusText}`)
	}

	const data = await res.json()
	const payload = data.data ?? data
	const estado = payload.status ?? payload.state
	const generado = Array.isArray(payload.generated)
		? payload.generated
		: Array.isArray(payload.images)
			? payload.images
			: []

	let imagenUrl = generado[0] ?? null
	if (imagenUrl && typeof imagenUrl === 'object') {
		imagenUrl = imagenUrl.url ?? imagenUrl.image_url ?? imagenUrl.base64 ?? null
	}

	if (!estado) {
		console.error('[Magnific] Respuesta de estado inesperada:', JSON.stringify(data))
	}

	return { estado, imagenUrl }
}
