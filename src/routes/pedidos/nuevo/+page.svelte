<script lang="ts">
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabase'
	import { session } from '$lib/stores/auth'
	import { mostrarToast } from '$lib/stores/ui'
	import { fmt } from '$lib/utils/format'
	import { get } from 'svelte/store'
	import { TIPO_LABEL } from '$lib/types'
	import type { TipoProducto } from '$lib/types'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// ── Tipos de producto disponibles ──
	const tiposProducto: { tipo: TipoProducto; label: string; icon: string }[] = [
		{ tipo: 'nube', label: 'Aviso Nube', icon: '☁️' },
		{ tipo: 'letra', label: 'Letra por Letra', icon: '🔤' },
		{ tipo: 'neon', label: 'Neon Flex', icon: '💡' },
		{ tipo: 'vinilo', label: 'Vinilo', icon: '🖼️' },
		{ tipo: 'acrilio', label: 'Acrilico', icon: '🔶' },
		{ tipo: 'acrilio_circular', label: 'Circular', icon: '⚪' },
		{ tipo: 'unico', label: 'Producto Unico', icon: '⭐' }
	]

	// ── Estado del pedido ──
	let clienteId = $state('')
	let fechaEntrega = $state('')
	let nota = $state('')
	let abonoInicial = $state(0)
	let bancoAbono = $state('')
	let guardando = $state(false)

	const bancos = $derived(data.bancos ?? [])

	// ── Nuevo cliente inline ──
	let creandoCliente = $state(false)
	let nuevoNombre = $state('')
	let nuevoContacto = $state('')
	let guardandoCliente = $state(false)

	// ── Carrito local ──
	interface ItemCarritoLocal {
		id: string
		tipo: TipoProducto
		tipo_label: string
		descripcion: string
		precio_fabricacion: number
		precio_cliente: number
		medidas: string
	}

	let carrito = $state<ItemCarritoLocal[]>([])

	// ── Formulario para agregar producto ──
	let tipoSeleccionado = $state<TipoProducto>('nube')
	let formDescripcion = $state('')
	let formPrecioFab = $state(0)
	let formPrecioCliente = $state(0)
	let formMedidas = $state('')

	const esUnico = $derived(tipoSeleccionado === 'unico')

	// ── Calculos ──
	let costoTotal = $derived(carrito.reduce((s, i) => s + i.precio_fabricacion, 0))
	let precioTotal = $derived(carrito.reduce((s, i) => s + i.precio_cliente, 0))
	let ganancia = $derived(precioTotal - costoTotal)

	function agregarAlCarrito() {
		if (!formDescripcion.trim()) return mostrarToast('La descripcion es obligatoria', 'error')
		if (formPrecioCliente <= 0) return mostrarToast('El precio cliente debe ser mayor a 0', 'error')

		const costoFinal = formPrecioFab > 0 ? formPrecioFab : Math.round(formPrecioCliente * 0.6)

		carrito = [...carrito, {
			id: crypto.randomUUID(),
			tipo: tipoSeleccionado,
			tipo_label: TIPO_LABEL[tipoSeleccionado],
			descripcion: formDescripcion.trim() + (formMedidas.trim() ? ` | Medidas: ${formMedidas.trim()}` : ''),
			precio_fabricacion: Math.round(costoFinal),
			precio_cliente: Math.round(formPrecioCliente),
			medidas: formMedidas.trim()
		}]

		// Reset
		formDescripcion = ''
		formPrecioFab = 0
		formPrecioCliente = 0
		formMedidas = ''
		mostrarToast('Producto agregado al carrito')
	}

	function quitarDelCarrito(id: string) {
		carrito = carrito.filter((i) => i.id !== id)
	}

	// ── Crear cliente ──
	async function crearCliente() {
		if (!nuevoNombre.trim()) return mostrarToast('El nombre es obligatorio', 'error')
		guardandoCliente = true
		const { data: nuevo, error } = await supabase
			.from('clientes')
			.insert({
				nombre: nuevoNombre.trim(),
				contacto: nuevoContacto.trim() || null
			})
			.select('id, nombre, empresa')
			.single()
		guardandoCliente = false
		if (error || !nuevo) return mostrarToast('Error al crear cliente', 'error')

		data.clientes = [...data.clientes, nuevo]
		clienteId = nuevo.id
		creandoCliente = false
		nuevoNombre = ''
		nuevoContacto = ''
		mostrarToast('Cliente creado')
	}

	// ── Guardar pedido ──
	async function guardarPedido() {
		if (carrito.length === 0) return mostrarToast('Agrega al menos un producto', 'error')
		if (!clienteId) return mostrarToast('Selecciona un cliente', 'error')

		const abono = Math.max(0, Math.round(Number(abonoInicial) || 0))
		if (abono > Math.round(precioTotal)) {
			return mostrarToast('El abono no puede ser mayor al total', 'error')
		}

		guardando = true
		const userId = get(session)?.user?.id ?? null

		// 1. Crear el pedido
		const { data: pedido, error: errPedido } = await supabase
			.from('pedidos')
			.insert({
				cliente_id: clienteId,
				creado_por: userId,
				estado: 'Pedido realizado',
				precio_total: Math.round(precioTotal),
				abono,
				fecha_entrega: fechaEntrega || null,
				nota: nota.trim() || null
			})
			.select('id')
			.single()

		if (errPedido || !pedido) {
			guardando = false
			return mostrarToast('Error al crear pedido', 'error')
		}

		// 2. Insertar items
		const itemsDB = carrito.map((item, idx) => ({
			pedido_id: pedido.id,
			tipo: item.tipo,
			tipo_label: item.tipo_label,
			descripcion: item.descripcion,
			precio_fabricacion: item.precio_fabricacion,
			precio_cliente: item.precio_cliente,
			estado_produccion: 'pendiente',
			orden: idx
		}))

		const { error: errItems } = await supabase.from('pedido_items').insert(itemsDB)

		if (errItems) {
			guardando = false
			return mostrarToast('Error al guardar productos', 'error')
		}

		// 3. Registrar abono inicial si aplica
		if (abono > 0) {
			await supabase.from('movimientos_financieros').insert({
				pedido_id: pedido.id,
				tipo: 'abono',
				concepto: 'Abono inicial al crear pedido',
				monto: abono,
				fecha: new Date().toISOString().slice(0, 10),
				registrado_por: userId,
				banco_id: bancoAbono || null
			})

			await supabase.from('pedido_notas').insert({
				pedido_id: pedido.id,
				autor_id: userId,
				contenido: `[Abono] Abono inicial de ${fmt(abono)}`
			})
		}

		guardando = false
		mostrarToast('Pedido creado')
		goto('/pedidos')
	}
</script>

<svelte:head>
	<title>Nuevo pedido — Nexus LED</title>
</svelte:head>

<div>
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a href="/pedidos" class="text-[var(--text-dim)] hover:text-[var(--text)]">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
		</a>
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Nuevo pedido</h1>
			<p class="mt-0.5 text-sm text-[var(--text-muted)]">Crea un pedido directamente sin cotizacion</p>
		</div>
	</div>

	<div class="mt-6 grid gap-6 lg:grid-cols-3">
		<!-- ═══ Columna principal ═══ -->
		<div class="lg:col-span-2 space-y-4">

			<!-- Formulario para agregar producto -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-5 py-3">
					<h2 class="text-sm font-medium text-[var(--text)]">Agregar producto</h2>
				</div>
				<div class="p-5 space-y-4">
					<!-- Selector de tipo -->
					<div>
						<label class="mb-2 block text-xs font-medium text-[var(--text-muted)]">Tipo de producto</label>
						<div class="flex flex-wrap gap-2">
							{#each tiposProducto as tp}
								<button
									type="button"
									onclick={() => (tipoSeleccionado = tp.tipo)}
									class="tipo-btn rounded-lg px-3 py-2 text-xs transition-all"
									class:tipo-activo={tipoSeleccionado === tp.tipo}
									class:tipo-unico={tp.tipo === 'unico' && tipoSeleccionado === tp.tipo}
								>
									<span>{tp.icon}</span>
									<span>{tp.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Descripcion -->
					<div>
						<label for="desc" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">
							Descripcion *
						</label>
						<textarea
							id="desc"
							rows="2"
							bind:value={formDescripcion}
							placeholder={esUnico ? 'Describe el producto especial...' : `Describe el ${TIPO_LABEL[tipoSeleccionado]}...`}
							class="input-field w-full resize-none"
						></textarea>
					</div>

					<!-- Medidas (visible para todos, destacado para unico) -->
					{#if esUnico}
						<div>
							<label for="medidas" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">
								Medidas
							</label>
							<input
								id="medidas"
								type="text"
								bind:value={formMedidas}
								placeholder="Ej: 120cm x 80cm, diametro 50cm..."
								class="input-field w-full"
							/>
						</div>
					{/if}

					<!-- Precios -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="fab" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">
								Costo fabricacion <span class="font-normal text-[var(--text-dim)]">(vacio = 60% del precio)</span>
							</label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
								<input
									id="fab"
									type="number"
									bind:value={formPrecioFab}
									min="0"
									class="input-field w-full !pl-8"
								/>
							</div>
						</div>
						<div>
							<label for="cliente" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">
								Precio cliente *
							</label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
								<input
									id="cliente"
									type="number"
									bind:value={formPrecioCliente}
									min="0"
									class="input-field w-full !pl-8"
								/>
							</div>
						</div>
					</div>

					{#if formPrecioCliente > 0 && formPrecioFab > 0}
						<p class="text-[10px] text-[var(--text-dim)]">
							Utilidad: {fmt(formPrecioCliente - formPrecioFab)} ({Math.round(((formPrecioCliente - formPrecioFab) / formPrecioCliente) * 100)}%)
						</p>
					{/if}

					<!-- Boton agregar -->
					<button
						type="button"
						onclick={agregarAlCarrito}
						class="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						Agregar al carrito
					</button>
				</div>
			</div>

			<!-- Carrito -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-5 py-3">
					<h2 class="text-sm font-medium text-[var(--text)]">
						Carrito ({carrito.length} producto{carrito.length !== 1 ? 's' : ''})
					</h2>
				</div>

				{#if carrito.length === 0}
					<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">
						Agrega productos usando el formulario de arriba
					</div>
				{:else}
					<ul>
						{#each carrito as item, idx (item.id)}
							<li class="border-b border-[var(--border)] last:border-b-0 px-5 py-4">
								<div class="flex items-start gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-[10px] text-[var(--text-dim)]">#{idx + 1}</span>
											<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {item.tipo === 'unico' ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--bg-card-2)] text-[var(--text-muted)]'}">
												{item.tipo_label}
											</span>
										</div>
										<p class="mt-1 text-sm text-[var(--text)]">{item.descripcion}</p>
										<div class="mt-1 flex gap-4 text-[10px]">
											<span class="text-[var(--warning)]">Fab: {fmt(item.precio_fabricacion)}</span>
											<span class="text-[var(--text-muted)]">Cliente: {fmt(item.precio_cliente)}</span>
											{#if item.precio_cliente > 0 && item.precio_fabricacion > 0}
												<span class="text-green-400">
													Utilidad: {fmt(item.precio_cliente - item.precio_fabricacion)}
												</span>
											{/if}
										</div>
									</div>
									<button
										type="button"
										onclick={() => quitarDelCarrito(item.id)}
										class="mt-1 text-[var(--text-dim)] hover:text-red-400 transition-colors"
										title="Quitar"
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<!-- ═══ Columna lateral ═══ -->
		<div class="space-y-4">
			<!-- Resumen -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Resumen</h2>
				<dl class="space-y-2 text-sm">
					<div class="flex justify-between">
						<dt class="text-[var(--text-muted)]">Costo fabricacion</dt>
						<dd class="font-medium text-[var(--warning)]">{fmt(costoTotal)}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-[var(--text-muted)]">Total cliente</dt>
						<dd class="text-[var(--text)]">{fmt(precioTotal)}</dd>
					</div>
				</dl>

				<div class="mt-4 flex items-center justify-between rounded-lg bg-[var(--brand-dark)] px-4 py-3">
					<span class="text-sm font-medium text-[var(--brand-light)]">Total</span>
					<span class="text-xl font-bold text-[var(--text)]">{fmt(precioTotal)}</span>
				</div>

				{#if precioTotal > 0 && costoTotal > 0}
					<p class="mt-2 text-center text-[10px] text-[var(--text-dim)]">
						Ganancia: {fmt(ganancia)} ({Math.round((ganancia / precioTotal) * 100)}%)
					</p>
				{/if}
			</div>

			<!-- Cliente -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<h2 class="mb-3 text-sm font-medium text-[var(--text)]">Cliente</h2>

				{#if !creandoCliente}
					<select
						bind:value={clienteId}
						class="input-field w-full"
					>
						<option value="">Seleccionar cliente...</option>
						{#each data.clientes as c}
							<option value={c.id}>
								{c.nombre}{c.empresa ? ` — ${c.empresa}` : ''}
							</option>
						{/each}
					</select>
					<button
						type="button"
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
							class="input-field w-full"
						/>
						<input
							type="text"
							bind:value={nuevoContacto}
							placeholder="Telefono"
							class="input-field w-full"
						/>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={crearCliente}
								disabled={guardandoCliente}
								class="btn-primary flex-1 rounded-lg py-1.5 text-sm font-medium disabled:opacity-50"
							>{guardandoCliente ? 'Creando...' : 'Crear'}</button>
							<button
								type="button"
								onclick={() => (creandoCliente = false)}
								class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
							>Cancelar</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Fecha de entrega -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<label for="entrega" class="mb-2 block text-sm font-medium text-[var(--text)]">Fecha de entrega</label>
				<input
					id="entrega"
					type="date"
					bind:value={fechaEntrega}
					class="input-field w-full"
				/>
			</div>

			<!-- Abono inicial -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<label for="abono" class="mb-2 block text-sm font-medium text-[var(--text)]">
					Abono inicial <span class="font-normal text-[var(--text-dim)]">(opcional)</span>
				</label>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
					<input
						id="abono"
						type="number"
						bind:value={abonoInicial}
						min="0"
						max={precioTotal}
						placeholder="0"
						class="input-field w-full !pl-8"
					/>
				</div>

				{#if abonoInicial > 0 && bancos.length > 0}
					<div class="mt-3">
						<label for="banco-abono" class="mb-1 block text-[10px] text-[var(--text-muted)]">Registrar en</label>
						<select id="banco-abono" bind:value={bancoAbono} class="input-field w-full">
							<option value="">Sin especificar</option>
							{#each bancos as b}
								<option value={b.id}>{b.nombre}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if precioTotal > 0 && abonoInicial > 0}
					<p class="mt-2 text-[10px] text-[var(--text-dim)]">
						Saldo pendiente: <span class="text-[var(--text-muted)]">{fmt(Math.max(0, precioTotal - (Number(abonoInicial) || 0)))}</span>
					</p>
				{/if}
			</div>

			<!-- Nota -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<label for="nota-pedido" class="mb-2 block text-sm font-medium text-[var(--text)]">Nota (opcional)</label>
				<textarea
					id="nota-pedido"
					rows="2"
					bind:value={nota}
					placeholder="Notas internas..."
					class="input-field w-full resize-none"
				></textarea>
			</div>

			<!-- Boton guardar -->
			<button
				type="button"
				onclick={guardarPedido}
				disabled={guardando || carrito.length === 0 || !clienteId}
				class="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
			>
				{guardando ? 'Guardando...' : 'Crear pedido'}
			</button>
		</div>
	</div>
</div>

<style>
	.btn-primary {
		background: var(--brand);
		color: #080808;
		transition: background 0.15s;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-light);
	}

	.btn-secondary {
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.btn-secondary:hover {
		border-color: var(--brand);
		color: var(--brand-light);
	}

	.input-field {
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
	}
	.input-field:focus {
		border-color: var(--brand);
	}

	.tipo-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.tipo-btn:hover {
		border-color: var(--border-light);
		color: var(--text);
	}
	.tipo-activo {
		border-color: var(--brand) !important;
		color: var(--brand-light) !important;
		background: color-mix(in srgb, var(--brand) 10%, transparent);
	}
	.tipo-unico {
		border-color: #f59e0b !important;
		color: #fbbf24 !important;
		background: rgba(245, 158, 11, 0.1);
	}
</style>
