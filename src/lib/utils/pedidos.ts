// ══════════════════════════════════════════════════════════════════════════════
//  Lógica de flujo de pedidos: etapa derivada, semáforo de entrega, progreso.
//
//  El campo `pedidos.estado` lo mueve una persona a mano, así que se desfasa
//  de la realidad de los items. Estas funciones calculan la etapa *real* a
//  partir de los items y las compras, para poder avisar cuando no coinciden.
// ══════════════════════════════════════════════════════════════════════════════

import type { EstadoPedido } from '$lib/types'

// ─── Progreso de items ────────────────────────────────────────────────────────

export interface Progreso {
	terminados: number
	total:      number
	pct:        number
}

export function progresoItems(items: { estado_produccion?: string }[]): Progreso {
	const total = items.length
	const terminados = items.filter((i) => i.estado_produccion === 'terminado').length
	return { terminados, total, pct: total > 0 ? Math.round((terminados / total) * 100) : 0 }
}

export function progresoDisenos(items: { diseno_completado?: boolean }[]): Progreso {
	const total = items.length
	const terminados = items.filter((i) => i.diseno_completado).length
	return { terminados, total, pct: total > 0 ? Math.round((terminados / total) * 100) : 0 }
}

// ─── Material (compras) ───────────────────────────────────────────────────────

export type EstadoMaterial = 'sin_registrar' | 'por_pedir' | 'esperando' | 'completo'

export interface ResumenMaterial {
	estado:    EstadoMaterial
	label:     string
	recibidos: number
	total:     number
	/** El material llega después de la fecha prometida al cliente */
	riesgo:    boolean
}

export function resumenMaterial(
	compras: { estado?: string; fecha_estimada?: string | null }[],
	fechaEntrega?: string | null
): ResumenMaterial {
	const total = compras.length
	if (total === 0) {
		return { estado: 'sin_registrar', label: 'Sin material registrado', recibidos: 0, total: 0, riesgo: false }
	}

	const recibidos = compras.filter((c) => c.estado === 'recibido').length
	const porPedir  = compras.filter((c) => c.estado === 'por_pedir').length

	// Riesgo: alguna compra pendiente promete llegar después de la entrega
	const riesgo = !!fechaEntrega && compras.some(
		(c) => c.estado !== 'recibido' && !!c.fecha_estimada && c.fecha_estimada > fechaEntrega
	)

	if (recibidos === total) {
		return { estado: 'completo', label: `Material completo`, recibidos, total, riesgo: false }
	}
	if (porPedir === total) {
		return { estado: 'por_pedir', label: `Falta pedir ${porPedir}`, recibidos, total, riesgo }
	}
	return { estado: 'esperando', label: `Material ${recibidos}/${total}`, recibidos, total, riesgo }
}

// ─── Etapa derivada ───────────────────────────────────────────────────────────

/**
 * Calcula en qué etapa *está de verdad* el pedido según sus items y compras.
 * No escribe nada: sirve para comparar contra `pedido.estado` y avisar
 * cuando alguien olvidó mover el select.
 */
export function etapaSugerida(
	pedido:  { estado: string; fecha_entregado?: string | null; requiere_instalacion?: boolean },
	items:   { estado_produccion?: string; diseno_completado?: boolean }[],
	compras: { estado?: string }[] = []
): EstadoPedido {
	if (pedido.fecha_entregado) return 'Entregado'
	if (items.length === 0) return 'Pedido realizado'

	const prod = progresoItems(items)
	if (prod.terminados === prod.total) return 'Terminado'

	// Si hay algo en fabricación, ya se está armando
	if (items.some((i) => i.estado_produccion === 'en_fabricacion')) return 'En fabricación'

	// Material pedido y aún no llega → el pedido está en manos del proveedor
	const mat = resumenMaterial(compras)
	if (mat.estado === 'esperando' || mat.estado === 'por_pedir') {
		if (compras.some((c) => c.estado === 'pedido' || c.estado === 'recibido_parcial')) {
			return 'Enviado a proveedor'
		}
	}

	// Diseños en marcha pero nada fabricándose todavía
	const dis = progresoDisenos(items)
	if (dis.terminados > 0) return 'En proceso'

	return 'Pedido realizado'
}

/** True si el estado guardado va atrasado respecto a lo que dicen los items */
export function estadoDesfasado(
	pedido:  { estado: string; fecha_entregado?: string | null; requiere_instalacion?: boolean },
	items:   { estado_produccion?: string; diseno_completado?: boolean }[],
	compras: { estado?: string }[] = []
): EstadoPedido | null {
	const sugerida = etapaSugerida(pedido, items, compras)
	return sugerida === pedido.estado ? null : sugerida
}

// ─── Semáforo de entrega ──────────────────────────────────────────────────────

export type NivelEntrega = 'sin_fecha' | 'entregado' | 'vencido' | 'hoy' | 'urgente' | 'proximo' | 'holgado'

export interface Semaforo {
	nivel:   NivelEntrega
	/** Días hasta la entrega. Negativo = vencido. null si no hay fecha. */
	dias:    number | null
	label:   string
	/** Clases Tailwind para el chip */
	clase:   string
	/** Clase de color para el punto / borde de la tarjeta */
	punto:   string
}

/** Días calendario entre hoy y una fecha ISO (YYYY-MM-DD), en hora local */
export function diasHasta(fechaIso: string | null | undefined): number | null {
	if (!fechaIso) return null
	const hoy = new Date()
	hoy.setHours(0, 0, 0, 0)
	const [y, m, d] = fechaIso.slice(0, 10).split('-').map(Number)
	if (!y || !m || !d) return null
	const objetivo = new Date(y, m - 1, d)
	objetivo.setHours(0, 0, 0, 0)
	return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000)
}

export function semaforoEntrega(
	fechaEntrega: string | null | undefined,
	fechaEntregado?: string | null,
	estado?: string
): Semaforo {
	if (fechaEntregado || estado === 'Entregado') {
		return {
			nivel: 'entregado',
			dias: null,
			label: 'Entregado',
			clase: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
			punto: 'bg-emerald-500'
		}
	}

	const dias = diasHasta(fechaEntrega)
	if (dias === null) {
		return {
			nivel: 'sin_fecha',
			dias: null,
			label: 'Sin fecha',
			clase: 'bg-gray-500/10 text-gray-400 border-gray-500/25',
			punto: 'bg-gray-500'
		}
	}

	if (dias < 0) {
		const n = Math.abs(dias)
		return {
			nivel: 'vencido',
			dias,
			label: `Vencido ${n} día${n > 1 ? 's' : ''}`,
			clase: 'bg-red-500/15 text-red-400 border-red-500/40',
			punto: 'bg-red-500'
		}
	}
	if (dias === 0) {
		return {
			nivel: 'hoy',
			dias,
			label: 'Entrega HOY',
			clase: 'bg-red-500/15 text-red-300 border-red-500/40',
			punto: 'bg-red-400'
		}
	}
	if (dias <= 2) {
		return {
			nivel: 'urgente',
			dias,
			label: `En ${dias} día${dias > 1 ? 's' : ''}`,
			clase: 'bg-amber-500/15 text-amber-400 border-amber-500/35',
			punto: 'bg-amber-500'
		}
	}
	if (dias <= 7) {
		return {
			nivel: 'proximo',
			dias,
			label: `En ${dias} días`,
			clase: 'bg-yellow-500/10 text-yellow-400/90 border-yellow-500/25',
			punto: 'bg-yellow-500'
		}
	}
	return {
		nivel: 'holgado',
		dias,
		label: `En ${dias} días`,
		clase: 'bg-green-500/10 text-green-400/90 border-green-500/25',
		punto: 'bg-green-500'
	}
}

// ─── Orden del tablero ────────────────────────────────────────────────────────

/**
 * Ordena pedidos por urgencia: prioridad manual primero, luego fecha de
 * entrega más próxima, y los sin fecha al final.
 */
export function ordenarPorUrgencia<T extends { prioridad?: number; fecha_entrega?: string | null; created_at?: string }>(
	pedidos: T[]
): T[] {
	return [...pedidos].sort((a, b) => {
		const pa = a.prioridad ?? 0
		const pb = b.prioridad ?? 0
		if (pa !== pb) return pb - pa

		const da = diasHasta(a.fecha_entrega)
		const db = diasHasta(b.fecha_entrega)
		if (da === null && db === null) {
			return (a.created_at ?? '').localeCompare(b.created_at ?? '')
		}
		if (da === null) return 1
		if (db === null) return -1
		return da - db
	})
}

// ─── Etiquetas de prioridad ───────────────────────────────────────────────────

export function clasePrioridad(prioridad: number | undefined): string {
	if (prioridad === 2) return 'bg-red-500/15 text-red-400 border-red-500/40'
	if (prioridad === 1) return 'bg-orange-500/15 text-orange-400 border-orange-500/35'
	return ''
}
