import { supabase } from '$lib/supabase'

const BUCKET = 'imagenes'

/**
 * Sube un archivo (imagen) a Supabase Storage y devuelve la URL pública.
 * Genera un nombre único para evitar colisiones.
 */
export async function subirImagen(
	file: File,
	carpeta: string = 'referencias'
): Promise<{ url: string; error: string | null }> {
	const ext = file.name.split('.').pop() ?? 'jpg'
	const nombre = `${carpeta}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

	const { error } = await supabase.storage
		.from(BUCKET)
		.upload(nombre, file, {
			cacheControl: '3600',
			upsert: false
		})

	if (error) {
		console.error('Error subiendo imagen:', error)
		return { url: '', error: error.message }
	}

	const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombre)

	return { url: urlData.publicUrl, error: null }
}

/**
 * Comprime una imagen antes de subirla (reduce megabytes de fotos de celular).
 * Devuelve un File con calidad reducida.
 */
export async function comprimirImagen(file: File, maxAncho = 1600, calidad = 0.8): Promise<File> {
	return new Promise((resolve) => {
		// Si no es imagen, devolver tal cual
		if (!file.type.startsWith('image/')) {
			resolve(file)
			return
		}

		const img = new Image()
		const url = URL.createObjectURL(file)

		img.onload = () => {
			URL.revokeObjectURL(url)

			let { width, height } = img
			if (width > maxAncho) {
				height = Math.round((height * maxAncho) / width)
				width = maxAncho
			}

			const canvas = document.createElement('canvas')
			canvas.width = width
			canvas.height = height

			const ctx = canvas.getContext('2d')!
			ctx.drawImage(img, 0, 0, width, height)

			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(new File([blob], file.name, { type: 'image/jpeg' }))
					} else {
						resolve(file)
					}
				},
				'image/jpeg',
				calidad
			)
		}

		img.onerror = () => {
			URL.revokeObjectURL(url)
			resolve(file)
		}

		img.src = url
	})
}

/**
 * Sube una imagen con compresión automática.
 */
export async function subirImagenComprimida(
	file: File,
	carpeta: string = 'referencias'
): Promise<{ url: string; error: string | null }> {
	const comprimida = await comprimirImagen(file)
	return subirImagen(comprimida, carpeta)
}
