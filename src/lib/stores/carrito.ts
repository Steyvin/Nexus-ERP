import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'
import type { TipoProducto } from '$lib/types'

export interface ItemCarrito {
	id: string
	tipo: TipoProducto
	tipo_label: string
	descripcion: string
	precio_fabricacion: number
	precio_cliente: number
	parametros: Record<string, unknown>
	archivo_diseno_url?: string
}

const STORAGE_KEY = 'nexus_carrito'

function crearCarritoStore() {
	const inicial: ItemCarrito[] = browser
		? (() => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } })()
		: []

	const store = writable<ItemCarrito[]>(inicial)

	if (browser) {
		store.subscribe((valor) => {
			try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valor)) } catch { /* sin-op */ }
		})
	}

	return store
}

export const items = crearCarritoStore()

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

export function actualizarArchivoDiseno(id: string, url: string | undefined) {
	items.update(($i) => $i.map((x) => (x.id === id ? { ...x, archivo_diseno_url: url || undefined } : x)))
}

export function limpiarCarrito() {
	items.set([])
}
