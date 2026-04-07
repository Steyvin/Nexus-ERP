import { writable, derived } from 'svelte/store'
import type { TipoProducto } from '$lib/types'

export interface ItemCarrito {
	id: string
	tipo: TipoProducto
	tipo_label: string
	descripcion: string
	precio_fabricacion: number
	precio_cliente: number
	parametros: Record<string, unknown>
}

export const items = writable<ItemCarrito[]>([])

export const totalItems = derived(items, ($i) => $i.length)
export const subtotalCarrito = derived(items, ($i) =>
	$i.reduce((s, item) => s + item.precio_cliente, 0)
)

export function agregarItem(item: Omit<ItemCarrito, 'id'>) {
	items.update(($i) => [...$i, { ...item, id: crypto.randomUUID() }])
}

export function eliminarItem(id: string) {
	items.update(($i) => $i.filter((x) => x.id !== id))
}

export function actualizarPrecio(id: string, precio_cliente: number) {
	items.update(($i) => $i.map((x) => (x.id === id ? { ...x, precio_cliente } : x)))
}

export function limpiarCarrito() {
	items.set([])
}
