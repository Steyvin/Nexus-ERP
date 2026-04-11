<script lang="ts">
	import { goto } from '$app/navigation'
	import { get } from 'svelte/store'
	import { supabase } from '$lib/supabase'
	import { session } from '$lib/stores/auth'
	import { mostrarToast } from '$lib/stores/ui'
	import { items, eliminarItem, actualizarPrecio, actualizarArchivoDiseno, limpiarCarrito } from '$lib/stores/carrito'
	import { fmt } from '$lib/utils/format'
	import ImageUpload from '$lib/components/ImageUpload.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// ── Estado ──
	let descuento = $state(0)
	let nota = $state('')
	let imagenUrl = $state('')
	let clienteId = $state('')
	let guardando = $state(false)

	// ── Nuevo cliente inline ──
	let creandoCliente = $state(false)
	let nuevoNombre = $state('')
	let nuevoContacto = $state('')
	let nuevoEmail = $state('')
	let guardandoCliente = $state(false)

	// ── Cálculos reactivos ──
	let subtotal = $derived($items.reduce((s, i) => s + i.precio_cliente, 0))
	let costoTotal = $derived($items.reduce((s, i) => s + i.precio_fabricacion, 0))
	let total = $derived(subtotal - descuento)

	// ── Crear cliente nuevo ──
	async function crearCliente() {
		if (!nuevoNombre.trim()) return mostrarToast('El nombre es obligatorio', 'error')
		guardandoCliente = true
		const { data: nuevo, error } = await supabase
			.from('clientes')
			.insert({
				nombre: nuevoNombre.trim(),
				contacto: nuevoContacto.trim() || null,
				email: nuevoEmail.trim() || null
			})
			.select('id, nombre, empresa')
			.single()
		guardandoCliente = false
		if (error || !nuevo) return mostrarToast('Error al crear cliente', 'error')

		// Agregar a la lista y seleccionarlo
		data.clientes = [...data.clientes, nuevo]
		clienteId = nuevo.id
		creandoCliente = false
		nuevoNombre = ''
		nuevoContacto = ''
		nuevoEmail = ''
		mostrarToast('Cliente creado')
	}

	// ── Guardar cotización ──
	async function guardarCotizacion() {
		const listaItems = get(items)
		if (listaItems.length === 0) return mostrarToast('El carrito está vacío', 'error')
		if (!clienteId) return mostrarToast('Selecciona un cliente', 'error')

		guardando = true
		const userId = get(session)?.user?.id ?? null

		// 1. Crear la cotización
		const { data: cot, error: errCot } = await supabase
			.from('cotizaciones')
			.insert({
				cliente_id: clienteId,
				creado_por: userId,
				precio_subtotal: Math.round(subtotal),
				precio_total: Math.round(total),
				descuento: Math.round(descuento),
				nota: nota.trim() || null,
				imagen_url: imagenUrl.trim() || null
			})
			.select('id')
			.single()

		if (errCot || !cot) {
			guardando = false
			return mostrarToast('Error al crear cotización', 'error')
		}

		// 2. Insertar los items
		const itemsDB = listaItems.map((item, idx) => ({
			cotizacion_id: cot.id,
			tipo: item.tipo,
			tipo_label: item.tipo_label,
			descripcion: item.descripcion,
			precio_fabricacion: Math.round(item.precio_fabricacion),
			precio_cliente: Math.round(item.precio_cliente),
			parametros: {
				...item.parametros,
				...(item.archivo_diseno_url ? { archivo_diseno_url: item.archivo_diseno_url } : {})
			},
			orden: idx
		}))

		const { error: errItems } = await supabase.from('cotizacion_items').insert(itemsDB)

		guardando = false
		if (errItems) return mostrarToast('Error al guardar items', 'error')

		limpiarCarrito()
		mostrarToast('Cotización creada')
		goto('/cotizaciones')
	}
</script>

<svelte:head>
	<title>Nueva cotización — Nexus LED</title>
</svelte:head>

<div>
	<div class="flex items-center gap-3">
		<a href="/calculadoras" class="text-[var(--text-dim)] hover:text-[var(--text)]">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
		</a>
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Nueva cotización</h1>
			<p class="mt-0.5 text-sm text-[var(--text-muted)]">Revisa el carrito y guarda como cotización</p>
		</div>
	</div>

	{#if $items.length === 0}
		<!-- Carrito vacío -->
		<div class="mt-8 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
			<svg class="mx-auto mb-3 text-[var(--text-dim)]" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
			<p class="text-sm text-[var(--text-muted)]">El carrito está vacío</p>
			<a href="/calculadoras" class="mt-3 inline-block text-sm text-[var(--brand-light)] hover:underline">
				Ir a calculadoras
			</a>
		</div>
	{:else}
		<div class="mt-6 grid gap-6 lg:grid-cols-3">
			<!-- Columna principal: items del carrito -->
			<div class="lg:col-span-2 space-y-4">
				<!-- Items -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3">
						<h2 class="text-sm font-medium text-[var(--text)]">
							Productos ({$items.length})
						</h2>
					</div>
					<ul>
						{#each $items as item, idx (item.id)}
							<li class="border-b border-[var(--border)] last:border-b-0 px-5 py-4">
								<div class="flex items-start gap-4">
									<!-- Info -->
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="rounded bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
												{item.tipo_label}
											</span>
											<span class="text-xs text-[var(--text-dim)]">#{idx + 1}</span>
										</div>
										<p class="mt-1 text-sm text-[var(--text)]">{item.descripcion}</p>
										<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
											Costo fab: {fmt(item.precio_fabricacion)}
										</p>
										
										<div class="mt-3 max-w-sm">
											<ImageUpload
												value={item.archivo_diseno_url ?? ''}
												onchange={(url) => actualizarArchivoDiseno(item.id, url)}
												carpeta="disenos"
												placeholder="Foto de referencia"
												compact={true}
											/>
										</div>
									</div>

									<!-- Precio editable -->
									<div class="flex flex-col items-end gap-1">
										<label class="text-[10px] text-[var(--text-dim)]">Precio cliente</label>
										<div class="flex items-center gap-1">
											<span class="text-xs text-[var(--text-dim)]">$</span>
											<input
												type="number"
												value={item.precio_cliente}
												oninput={(e) => {
													const v = Number((e.currentTarget as HTMLInputElement).value)
													if (v >= 0) actualizarPrecio(item.id, v)
												}}
												class="w-28 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-right text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"
											/>
										</div>
									</div>

									<!-- Eliminar -->
									<button
										onclick={() => eliminarItem(item.id)}
										class="mt-1 text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
										title="Eliminar"
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</div>

				<!-- Nota e imagen -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
					<div>
						<label for="nota" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nota (opcional)</label>
						<textarea
							id="nota"
							rows="2"
							bind:value={nota}
							placeholder="Notas internas o para el cliente..."
							class="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--brand)]"
						></textarea>
					</div>
					<div>
						<label class="mb-2 block text-xs font-medium text-[var(--text-muted)]">Imagen de referencia (opcional)</label>
						<ImageUpload
							bind:value={imagenUrl}
							carpeta="cotizaciones"
							placeholder="Subir imagen de referencia"
						/>
					</div>
				</div>
			</div>

			<!-- Columna lateral: resumen + cliente -->
			<div class="space-y-4">
				<!-- Resumen de precios -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Resumen</h2>

					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Costo fabricación</dt>
							<dd class="font-medium text-[var(--warning)]">{fmt(costoTotal)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Subtotal cliente</dt>
							<dd class="text-[var(--text)]">{fmt(subtotal)}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--text-muted)]">Descuento</dt>
							<dd class="flex items-center gap-1">
								<span class="text-xs text-[var(--text-dim)]">$</span>
								<input
									type="number"
									bind:value={descuento}
									min="0"
									class="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-right text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"
								/>
							</dd>
						</div>
					</dl>

					<div class="mt-4 flex items-center justify-between rounded-lg bg-[var(--brand-dark)] px-4 py-3">
						<span class="text-sm font-medium text-[var(--brand-light)]">Total</span>
						<span class="text-xl font-bold text-[var(--text)]">{fmt(total)}</span>
					</div>

					{#if subtotal > 0}
						<p class="mt-2 text-center text-[10px] text-[var(--text-dim)]">
							Ganancia: {fmt(total - costoTotal)} ({Math.round(((total - costoTotal) / total) * 100)}%)
						</p>
					{/if}
				</div>

				<!-- Selección de cliente -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-3 text-sm font-medium text-[var(--text)]">Cliente</h2>

					{#if !creandoCliente}
						<select
							bind:value={clienteId}
							class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"
						>
							<option value="">Seleccionar cliente...</option>
							{#each data.clientes as c}
								<option value={c.id}>
									{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}
								</option>
							{/each}
						</select>

						<button
							onclick={() => (creandoCliente = true)}
							class="mt-2 flex items-center gap-1 text-xs text-[var(--brand-light)] hover:underline"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
							Crear cliente nuevo
						</button>
					{:else}
						<div class="space-y-2">
							<input
								type="text"
								bind:value={nuevoNombre}
								placeholder="Nombre *"
								class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--brand)]"
							/>
							<input
								type="text"
								bind:value={nuevoContacto}
								placeholder="Teléfono"
								class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--brand)]"
							/>
							<input
								type="email"
								bind:value={nuevoEmail}
								placeholder="Email"
								class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--brand)]"
							/>
							<div class="flex gap-2">
								<button
									onclick={crearCliente}
									disabled={guardandoCliente}
									class="btn-primary flex-1 rounded-lg py-1.5 text-sm font-medium disabled:opacity-50"
								>
									{guardandoCliente ? 'Creando...' : 'Crear'}
								</button>
								<button
									onclick={() => (creandoCliente = false)}
									class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
								>
									Cancelar
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Botón guardar -->
				<button
					onclick={guardarCotizacion}
					disabled={guardando || $items.length === 0 || !clienteId}
					class="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
				>
					{guardando ? 'Guardando...' : 'Guardar cotización'}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.btn-primary {
		background: var(--brand);
		color: #fff;
		transition: background 0.15s;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-light);
	}
</style>
