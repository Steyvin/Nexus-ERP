import { fail } from '@sveltejs/kit'
import { z } from 'zod'

// ── Helper: parsear y validar FormData con un schema Zod ──────────────────────

/**
 * Parsea un FormData con un schema Zod. Retorna los datos tipados o un fail(400).
 * Uso: const datos = parseForm(miSchema, form); if ('error' in datos) return datos;
 */
export function parseForm<T extends z.ZodTypeAny>(
	schema: T,
	form: FormData
): z.infer<T> | ReturnType<typeof fail> {
	const raw: Record<string, unknown> = {}
	for (const [key, value] of form.entries()) {
		raw[key] = value
	}

	const result = schema.safeParse(raw)
	if (!result.success) {
		const errores = result.error.issues.map((i) => i.message).join(', ')
		return fail(400, { error: `Datos inválidos: ${errores}` })
	}

	return result.data
}

/** Verifica si el resultado del parseForm es un error */
export function esError(resultado: unknown): resultado is ReturnType<typeof fail> {
	return typeof resultado === 'object' && resultado !== null && 'status' in resultado
}

// ── Validadores reutilizables ─────────────────────────────────────────────────

const uuid = z.string().uuid('ID inválido')
const textoRequerido = z.string().min(1, 'Campo requerido').max(5000)
const textoOpcional = z.string().max(5000).optional().default('')
const numero = z.coerce.number()
const numeroPositivo = z.coerce.number().min(0, 'Debe ser positivo')

// ── Schemas para Pedidos ──────────────────────────────────────────────────────

export const cambiarEstadoItemSchema = z.object({
	item_id: uuid,
	estado: z.enum(['pendiente', 'en_fabricacion', 'terminado'], {
		errorMap: () => ({ message: 'Estado de producción inválido' })
	})
})

export const cambiarEstadoPedidoSchema = z.object({
	pedido_id: uuid,
	estado: z.enum([
		'Pedido realizado', 'En proceso', 'Enviado a proveedor',
		'En fabricación', 'Terminado', 'Entregado'
	], { errorMap: () => ({ message: 'Estado de pedido inválido' }) })
})

export const subirDisenoSchema = z.object({
	item_id: uuid,
	archivo_url: z.string().url('URL de archivo inválida').or(
		z.string().startsWith('https://', 'URL debe ser HTTPS')
	)
})

export const asignarItemSchema = z.object({
	item_id: uuid,
	user_id: z.string().max(100).default('')
})

export const eliminarPedidoSchema = z.object({
	pedido_id: uuid
})

export const marcarDisenoSchema = z.object({
	item_id: uuid,
	pedido_id: uuid,
	descripcion: textoOpcional,
	completado: z.enum(['true', 'false']).transform((v) => v === 'true')
})

export const agregarNotaSchema = z.object({
	pedido_id: uuid,
	contenido: textoRequerido
})

export const actualizarPedidoSchema = z.object({
	pedido_id: uuid,
	fecha_entrega: textoOpcional,
	abono: numeroPositivo,
	nota: textoOpcional
})

// ── Schemas para Pedidos [id] (con campos extra para timeline) ────────────────

export const cambiarEstadoItemDetalleSchema = cambiarEstadoItemSchema.extend({
	pedido_id: uuid,
	descripcion: textoOpcional,
	estado_anterior: textoOpcional
})

export const cambiarEstadoPedidoDetalleSchema = cambiarEstadoPedidoSchema.extend({
	estado_anterior: textoOpcional
})

export const subirDisenoDetalleSchema = subirDisenoSchema.extend({
	pedido_id: uuid,
	descripcion: textoOpcional
})

export const asignarItemDetalleSchema = asignarItemSchema.extend({
	pedido_id: uuid,
	descripcion: textoOpcional,
	nombre_asignado: textoOpcional
})

// ── Schemas para Cotizaciones ─────────────────────────────────────────────────

export const actualizarItemCotSchema = z.object({
	item_id: uuid,
	cotizacion_id: uuid,
	precio_cliente: numeroPositivo,
	descuento: numero.default(0)
})

export const actualizarTotalCotSchema = z.object({
	id: uuid,
	precio_total: numeroPositivo
})

export const cambiarEstadoCotSchema = z.object({
	id: uuid,
	estado: z.enum(['pendiente', 'aprobada', 'convertida', 'cancelada'], {
		errorMap: () => ({ message: 'Estado de cotización inválido' })
	})
})

export const convertirPedidoSchema = z.object({
	id: uuid,
	abono: numero.default(0)
})

export const eliminarCotSchema = z.object({
	id: uuid
})

// ── Schemas para Usuarios ─────────────────────────────────────────────────────

export const crearUsuarioSchema = z.object({
	nombre: textoRequerido,
	username: z.string().max(50).optional().default(''),
	email: z.string().email('Email inválido'),
	clave: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres'),
	rol: z.enum(['admin', 'fabricador', 'diseñador', 'finanzas'], {
		errorMap: () => ({ message: 'Rol inválido' })
	})
})

export const cambiarRolSchema = z.object({
	user_id: uuid,
	rol: z.enum(['admin', 'fabricador', 'diseñador', 'finanzas'], {
		errorMap: () => ({ message: 'Rol inválido' })
	})
})

export const toggleActivoSchema = z.object({
	user_id: uuid,
	activo: z.string()
})

export const eliminarUsuarioSchema = z.object({
	user_id: uuid
})

export const cambiarClaveSchema = z.object({
	user_id: uuid,
	nueva_clave: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres')
})
