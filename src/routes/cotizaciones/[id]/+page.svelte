<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const cot = $derived(data.cotizacion)
	const cliente = $derived((cot as any).clientes)
	const creador = $derived((cot as any).perfiles)
	const items = $derived((cot as any).cotizacion_items ?? [])
	const puedeVerCostos = $derived(data.rol === 'admin' || data.rol === 'finanzas')
	const puedeGestionar = $derived(data.rol === 'admin' || data.rol === 'finanzas')
	const esEditable = $derived(cot.estado === 'pendiente')

	let editandoItem = $state<string | null>(null)
	let precioEditado = $state(0)
	let confirmandoEliminar = $state(false)
	let confirmandoConvertir = $state(false)

	// Editar precio total manualmente
	let editandoTotal = $state(false)
	let totalEditado = $state(0)

	// Abono al convertir en pedido
	let montoAbono = $state(0)

	const costoFab = $derived(items.reduce((s: number, i: any) => s + Number(i.precio_fabricacion ?? 0), 0))
	const subtotal = $derived(items.reduce((s: number, i: any) => s + Number(i.precio_cliente ?? 0), 0))
	const ganancia = $derived(cot.precio_total - costoFab)
	const margenPct = $derived(cot.precio_total > 0 ? Math.round((ganancia / cot.precio_total) * 100) : 0)

	const estadoColor: Record<string, string> = {
		pendiente: 'bg-yellow-500/15 text-yellow-400',
		aprobada: 'bg-blue-500/15 text-blue-400',
		cancelada: 'bg-red-500/15 text-red-400'
	}

	const estadoLabel: Record<string, string> = {
		pendiente: 'Pendiente',
		aprobada: 'Aprobada',
		cancelada: 'Cancelada'
	}

	function iniciarEdicion(item: any) {
		editandoItem = item.id
		precioEditado = Number(item.precio_cliente)
	}

	function cancelarEdicion() {
		editandoItem = null
	}

	function iniciarEdicionTotal() {
		totalEditado = cot.precio_total
		editandoTotal = true
	}

	function cancelarEdicionTotal() {
		editandoTotal = false
	}
</script>

<svelte:head>
	<title>Cotización — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/cotizaciones" class="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-semibold text-[var(--text)]">Cotización</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {estadoColor[cot.estado] ?? ''}">
						{estadoLabel[cot.estado] ?? cot.estado}
					</span>
				</div>
				<p class="mt-0.5 text-xs text-[var(--text-dim)]">
					Creada el {fmtFecha(cot.created_at)}
					{#if creador} por {creador.nombre}{/if}
				</p>
			</div>
		</div>

		<!-- Acciones -->
		{#if puedeGestionar}
			<div class="flex gap-2">
				{#if esEditable}
					<button
						onclick={() => (confirmandoConvertir = true)}
						class="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
					>Convertir en pedido</button>
				{/if}

				{#if cot.estado !== 'cancelada' && cot.estado !== 'aprobada'}
					<form method="POST" action="?/cambiarEstado" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								mostrarToast('Cotización cancelada')
								invalidateAll()
							}
						}
					}}>
						<input type="hidden" name="id" value={cot.id} />
						<input type="hidden" name="estado" value="cancelada" />
						<button class="btn-danger-outline rounded-lg px-4 py-2 text-sm font-medium">Cancelar</button>
					</form>
				{/if}

				<button
					onclick={() => (confirmandoEliminar = true)}
					class="btn-danger-outline rounded-lg px-3 py-2 text-sm"
					title="Eliminar cotización"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
				</button>
			</div>
		{/if}
	</div>

	<div class="mt-6 grid gap-6 lg:grid-cols-3">
		<!-- Columna principal -->
		<div class="lg:col-span-2 space-y-4">
			<!-- Items -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-5 py-3">
					<h2 class="text-sm font-medium text-[var(--text)]">
						Productos ({items.length})
					</h2>
				</div>

				{#if items.length === 0}
					<div class="py-10 text-center text-sm text-[var(--text-dim)]">Sin productos</div>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
								<th class="px-5 py-2.5 font-medium">#</th>
								<th class="px-5 py-2.5 font-medium">Producto</th>
								{#if puedeVerCostos}
									<th class="hidden px-5 py-2.5 font-medium sm:table-cell">Costo fab.</th>
								{/if}
								<th class="px-5 py-2.5 font-medium text-right">Precio cliente</th>
								{#if puedeGestionar && esEditable}
									<th class="px-5 py-2.5 font-medium w-16"></th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each items as item, idx (item.id)}
								<tr class="border-b border-[var(--border)] last:border-b-0">
									<td class="px-5 py-3 text-[var(--text-dim)]">{idx + 1}</td>
									<td class="px-5 py-3">
										<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
											{item.tipo_label}
										</span>
										<p class="mt-1 text-[var(--text)]">{item.descripcion}</p>

										<!-- Desglose si está en los parámetros -->
										{#if puedeVerCostos && item.parametros?.desglose}
											<details class="mt-1.5">
												<summary class="cursor-pointer text-[10px] text-[var(--text-dim)] hover:text-[var(--text-muted)]">
													Ver desglose
												</summary>
												<ul class="mt-1 space-y-0.5 pl-2 text-[10px] text-[var(--text-dim)]">
													{#each item.parametros.desglose as linea}
														<li class="flex justify-between gap-4">
															<span>{linea.concepto}</span>
															<span class="text-[var(--text-muted)]">{fmt(linea.valor)}</span>
														</li>
													{/each}
												</ul>
											</details>
										{/if}
									</td>
									{#if puedeVerCostos}
										<td class="hidden px-5 py-3 sm:table-cell">
											<span class="text-[var(--warning)]">{fmt(item.precio_fabricacion)}</span>
										</td>
									{/if}
									<td class="px-5 py-3 text-right">
										{#if editandoItem === item.id}
											<form method="POST" action="?/actualizarItem" use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														mostrarToast('Precio actualizado')
														editandoItem = null
														invalidateAll()
													}
												}
											}}>
												<input type="hidden" name="item_id" value={item.id} />
												<input type="hidden" name="cotizacion_id" value={cot.id} />
												<input type="hidden" name="descuento" value={cot.descuento} />
												<div class="flex items-center justify-end gap-1">
													<span class="text-xs text-[var(--text-dim)]">$</span>
													<input
														type="number"
														name="precio_cliente"
														bind:value={precioEditado}
														class="w-28 rounded-lg border border-[var(--brand)] bg-[var(--bg-card-2)] px-2 py-1 text-right text-sm text-[var(--text)] outline-none"
													/>
													<button type="submit" class="ml-1 text-[var(--success)] hover:text-green-300" title="Guardar">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
													</button>
													<button type="button" onclick={cancelarEdicion} class="text-[var(--text-dim)] hover:text-[var(--text)]" title="Cancelar">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
													</button>
												</div>
											</form>
										{:else}
											<span class="font-medium text-[var(--text)]">{fmt(item.precio_cliente)}</span>
										{/if}
									</td>
									{#if puedeGestionar && esEditable}
										<td class="px-5 py-3">
											{#if editandoItem !== item.id}
												<button
													onclick={() => iniciarEdicion(item)}
													class="text-[var(--text-dim)] hover:text-[var(--brand-light)] transition-colors"
													title="Editar precio"
												>
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
												</button>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>

			<!-- Nota -->
			{#if cot.nota}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-2 text-xs font-medium text-[var(--text-muted)]">Nota</h2>
					<p class="text-sm text-[var(--text)]">{cot.nota}</p>
				</div>
			{/if}

			<!-- Imagen de referencia -->
			{#if cot.imagen_url}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-2 text-xs font-medium text-[var(--text-muted)]">Imagen de referencia</h2>
					<img src={cot.imagen_url} alt="Referencia" class="max-h-64 rounded-lg object-contain" />
				</div>
			{/if}
		</div>

		<!-- Columna lateral -->
		<div class="space-y-4">
			<!-- Resumen financiero -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Resumen</h2>

				<dl class="space-y-2.5 text-sm">
					{#if puedeVerCostos}
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Costo fabricación</dt>
							<dd class="font-medium text-[var(--warning)]">{fmt(costoFab)}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-[var(--text-muted)]">Subtotal</dt>
						<dd class="text-[var(--text)]">{fmt(subtotal)}</dd>
					</div>
					{#if cot.descuento > 0}
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Descuento</dt>
							<dd class="text-red-400">-{fmt(cot.descuento)}</dd>
						</div>
					{/if}
				</dl>

				<div class="mt-4 rounded-lg bg-[var(--brand-dark)] px-4 py-3">
					{#if editandoTotal && puedeGestionar && esEditable}
						<form method="POST" action="?/actualizarTotal" use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') {
									mostrarToast('Precio total actualizado')
									editandoTotal = false
									invalidateAll()
								}
							}
						}}>
							<input type="hidden" name="id" value={cot.id} />
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-[var(--brand-light)]">Total</span>
								<div class="flex items-center gap-1.5">
									<span class="text-sm text-[var(--text-dim)]">$</span>
									<input
										type="number"
										name="precio_total"
										bind:value={totalEditado}
										class="w-32 rounded-lg border border-[var(--brand)] bg-[var(--bg-card-2)] px-2 py-1.5 text-right text-lg font-bold text-[var(--text)] outline-none"
									/>
									<button type="submit" class="text-[var(--success)] hover:text-green-300" title="Guardar">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									</button>
									<button type="button" onclick={cancelarEdicionTotal} class="text-[var(--text-dim)] hover:text-[var(--text)]" title="Cancelar">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
									</button>
								</div>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-[var(--brand-light)]">Total</span>
							<div class="flex items-center gap-2">
								<span class="text-xl font-bold text-[var(--text)]">{fmt(cot.precio_total)}</span>
								{#if puedeGestionar && esEditable}
									<button
										onclick={iniciarEdicionTotal}
										class="text-[var(--text-dim)] hover:text-[var(--brand-light)] transition-colors"
										title="Editar precio total"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
									</button>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if puedeVerCostos && subtotal > 0}
					<p class="mt-2 text-center text-[10px] text-[var(--text-dim)]">
						Ganancia: {fmt(ganancia)} ({margenPct}%)
					</p>
				{/if}
			</div>

			<!-- Info del cliente -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<h2 class="mb-3 text-sm font-medium text-[var(--text)]">Cliente</h2>
				{#if cliente}
					<div class="space-y-1.5 text-sm">
						<p class="font-medium text-[var(--text)]">{cliente.nombre}</p>
						{#if cliente.empresa}
							<p class="text-[var(--text-muted)]">{cliente.empresa}</p>
						{/if}
						{#if cliente.contacto}
							<p class="text-[var(--text-dim)]">{cliente.contacto}</p>
						{/if}
						{#if cliente.email}
							<p class="text-[var(--text-dim)]">{cliente.email}</p>
						{/if}
						{#if cliente.ciudad}
							<p class="text-[var(--text-dim)]">{cliente.ciudad}</p>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-[var(--text-dim)]">Sin cliente asignado</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Modal: Confirmar conversión a pedido -->
{#if confirmandoConvertir}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => { confirmandoConvertir = false; montoAbono = 0 }}>
		<div class="mx-4 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold text-[var(--text)]">Convertir en pedido</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				Se creará un pedido con los {items.length} producto{items.length !== 1 ? 's' : ''} de esta cotización
				por un total de {fmt(cot.precio_total)}. La cotización se marcará como "Aprobada".
			</p>

			<div class="mt-4">
				<label for="abono-input" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Monto de abono recibido</label>
				<div class="flex items-center gap-2">
					<span class="text-sm text-[var(--text-dim)]">$</span>
					<input
						id="abono-input"
						type="number"
						min="0"
						max={cot.precio_total}
						bind:value={montoAbono}
						placeholder="0"
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)] transition-colors"
					/>
				</div>
				{#if montoAbono > 0}
					<p class="mt-1.5 text-[11px] text-[var(--text-dim)]">
						Saldo pendiente: {fmt(cot.precio_total - montoAbono)}
					</p>
				{/if}
			</div>

			<div class="mt-5 flex justify-end gap-3">
				<button
					onclick={() => { confirmandoConvertir = false; montoAbono = 0 }}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
				>Cancelar</button>
				<form method="POST" action="?/convertirPedido" use:enhance>
					<input type="hidden" name="id" value={cot.id} />
					<input type="hidden" name="abono" value={montoAbono} />
					<button class="btn-primary rounded-lg px-5 py-2 text-sm font-medium">
						Convertir
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Confirmar eliminación -->
{#if confirmandoEliminar}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (confirmandoEliminar = false)}>
		<div class="mx-4 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold text-red-400">Eliminar cotización</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				Esta acción es permanente. Se eliminarán la cotización y todos sus productos.
			</p>
			<div class="mt-5 flex justify-end gap-3">
				<button
					onclick={() => (confirmandoEliminar = false)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
				>Cancelar</button>
				<form method="POST" action="?/eliminar" use:enhance>
					<input type="hidden" name="id" value={cot.id} />
					<button class="btn-danger rounded-lg px-5 py-2 text-sm font-medium">
						Eliminar
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.btn-primary {
		background: var(--brand);
		color: #fff;
		transition: background 0.15s;
	}
	.btn-primary:hover {
		background: var(--brand-light);
	}

.btn-danger {
		background: #ef4444;
		color: #fff;
		transition: background 0.15s;
	}
	.btn-danger:hover {
		background: #dc2626;
	}

	.btn-danger-outline {
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #f87171;
		background: transparent;
		transition: all 0.15s;
	}
	.btn-danger-outline:hover {
		border-color: rgba(239, 68, 68, 0.6);
		background: rgba(239, 68, 68, 0.1);
	}
</style>
