/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

declare const self: ServiceWorkerGlobalScope

// Nombre del cache versionado — se invalida con cada deploy
const CACHE = `nexus-erp-${version}`

// Archivos a pre-cachear: build compilado + archivos estáticos
const ASSETS = [...build, ...files]

// ── Instalación: pre-cachear todos los assets ──────────────────────────────
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	)
})

// ── Activación: limpiar caches viejos ─────────────────────────────────────
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	)
})

// ── Fetch: cache-first para assets, network-first para páginas ────────────
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return

	const url = new URL(event.request.url)

	// Ignorar peticiones a Supabase (siempre deben ir a la red)
	if (url.hostname.includes('supabase.co')) return

	// Ignorar peticiones cross-origin
	if (url.origin !== self.location.origin) return

	const isAsset = ASSETS.some((asset) => url.pathname === asset)
	const isPage  = url.pathname.startsWith('/') && !url.pathname.includes('.')

	if (isAsset) {
		// Cache-first: assets compilados no cambian entre deploys (tienen hash)
		event.respondWith(
			caches.match(event.request).then((cached) => cached ?? fetch(event.request))
		)
	} else if (isPage) {
		// Network-first: páginas siempre intentan red, caen a caché si hay error
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Actualizar cache con la respuesta fresca
					if (response.status === 200) {
						const clone = response.clone()
						caches.open(CACHE).then((cache) => cache.put(event.request, clone))
					}
					return response
				})
				.catch(() => {
					// Sin red: servir desde caché si está disponible
					return caches.match(event.request).then(
						(cached) =>
							cached ??
							new Response('<h1>Sin conexión</h1><p>Nexus ERP requiere conexión para funcionar correctamente.</p>', {
								headers: { 'Content-Type': 'text/html; charset=utf-8' },
								status: 503
							})
					)
				})
		)
	}
})

// ── Push notifications (estructura base — requiere configurar VAPID keys) ──
// Para activar:
//   1. Generar VAPID keys: npx web-push generate-vapid-keys
//   2. Agregar PUBLIC_VAPID_KEY al .env
//   3. Instalar: npm install web-push
//   4. Crear endpoint /api/push-subscribe y /api/push-send
//   5. Descomentar el bloque de push en +layout.svelte
self.addEventListener('push', (event) => {
	if (!event.data) return

	const data = event.data.json() as { title: string; body: string; url?: string }

	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: '/icons/icon-192.svg',
			badge: '/icons/icon-192.svg',
			data: { url: data.url ?? '/pedidos' },
			tag: 'nexus-erp-notification',
			renotify: true
		})
	)
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const url: string = (event.notification.data as { url: string }).url

	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clients) => {
				const existing = clients.find((c) => c.url.includes(self.location.origin))
				if (existing) {
					existing.focus()
					existing.navigate(url)
				} else {
					self.clients.openWindow(url)
				}
			})
	)
})
