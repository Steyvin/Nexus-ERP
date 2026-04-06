import { writable } from 'svelte/store'

// Sidebar abierta o cerrada (mobile)
export const sidebarAbierta = writable(false)

// Ruta activa para highlight en navegación
export const rutaActiva = writable('')

// Notificaciones/toasts
export interface Toast {
	id: string
	tipo: 'exito' | 'error' | 'info'
	mensaje: string
}
export const toasts = writable<Toast[]>([])

export function mostrarToast(mensaje: string, tipo: Toast['tipo'] = 'exito', duracion = 3000) {
	const id = crypto.randomUUID()
	toasts.update((t) => [...t, { id, tipo, mensaje }])
	setTimeout(() => {
		toasts.update((t) => t.filter((x) => x.id !== id))
	}, duracion)
}
