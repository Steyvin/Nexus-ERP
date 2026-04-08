<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { totalItems } from '$lib/stores/carrito'
	import { fmt, fmtRelativa } from '$lib/utils/format'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const puedeVerCostos = $derived(data.rol === 'admin' || data.rol === 'finanzas')

	const estados = [
		{ val: null, label: 'Todas' },
		{ val: 'pendiente', label: 'Pendientes' },
		{ val: 'aprobada', label: 'Aprobadas' },
		{ val: 'cancelada', label: 'Canceladas' }
	]

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

	let busquedaLocal = $state(data.busqueda ?? '')
	let fechaDesde = $state(data.fechaDesde ?? '')
	let fechaHasta = $state(data.fechaHasta ?? '')
	let mostrarFechas = $state(!!(data.fechaDesde || data.fechaHasta))

	function aplicarParams(overrides: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams)
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v)
			else params.delete(k)
		}
		params.delete('p')
		goto(`?${params}`)
	}

	function cambiarFiltro(val: string | null) {
		aplicarParams({ estado: val })
	}

	function buscar() {
		aplicarParams({ q: busquedaLocal.trim() || null })
	}

	function filtrarFechas() {
		aplicarParams({ desde: fechaDesde || null, hasta: fechaHasta || null })
	}

	function limpiarFechas() {
		fechaDesde = ''
		fechaHasta = ''
		mostrarFechas = false
		aplicarParams({ desde: null, hasta: null })
	}

	function irPagina(p: number) {
		const params = new URLSearchParams($page.url.searchParams)
		if (p > 1) params.set('p', String(p))
		else params.delete('p')
		goto(`?${params}`)
	}

	let totalPaginas = $derived(Math.ceil(data.total / data.porPagina))
</script>

<svelte:head>
	<title>Cotizaciones — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Cotizaciones</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">{data.total} cotización{data.total !== 1 ? 'es' : ''}</p>
		</div>
		<a
			href="/cotizaciones/nueva"
			class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Nueva cotización
			{#if $totalItems > 0}
				<span class="rounded-full bg-white/20 px-1.5 text-[10px]">{$totalItems}</span>
			{/if}
		</a>
	</div>

	<!-- Búsqueda y filtros -->
	<div class="mt-4 space-y-3">
		<!-- Barra de búsqueda -->
		<div class="flex gap-2">
			<div class="relative flex-1">
				<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				<input
					type="text"
					bind:value={busquedaLocal}
					placeholder="Buscar por nombre de cliente..."
					onkeydown={(e) => { if (e.key === 'Enter') buscar() }}
					class="input-field w-full pl-9 pr-3"
				/>
			</div>
			<button onclick={buscar} class="btn-secondary rounded-lg px-4 py-2 text-sm">
				Buscar
			</button>
			<button
				onclick={() => (mostrarFechas = !mostrarFechas)}
				class="btn-secondary rounded-lg px-3 py-2 text-sm"
				class:filtro-activo={mostrarFechas}
				title="Filtrar por fecha"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
			</button>
		</div>

		<!-- Filtro de fechas (colapsable) -->
		{#if mostrarFechas}
			<div class="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Desde</label>
					<input type="date" bind:value={fechaDesde} class="input-field text-sm" />
				</div>
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Hasta</label>
					<input type="date" bind:value={fechaHasta} class="input-field text-sm" />
				</div>
				<button onclick={filtrarFechas} class="btn-primary rounded-lg px-4 py-2 text-sm">Aplicar</button>
				{#if data.fechaDesde || data.fechaHasta}
					<button onclick={limpiarFechas} class="text-xs text-[var(--text-dim)] hover:text-[var(--text)]">Limpiar</button>
				{/if}
			</div>
		{/if}

		<!-- Filtros por estado -->
		<div class="flex gap-1 overflow-x-auto">
			{#each estados as e}
				<button
					onclick={() => cambiarFiltro(e.val)}
					class="filtro-btn whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors"
					class:filtro-activo={data.filtroEstado === e.val}
				>
					{e.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Lista -->
	<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
		{#if data.cotizaciones.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				No hay cotizaciones{data.filtroEstado ? ' con ese estado' : ''}{data.busqueda ? ` para "${data.busqueda}"` : ''}
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
						<th class="px-4 py-3 font-medium">Cliente</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">Productos</th>
						{#if puedeVerCostos}
							<th class="hidden px-4 py-3 font-medium md:table-cell">Costo fab.</th>
						{/if}
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Total</th>
						<th class="px-4 py-3 font-medium">Estado</th>
						<th class="hidden px-4 py-3 font-medium md:table-cell">Fecha</th>
					</tr>
				</thead>
				<tbody>
					{#each data.cotizaciones as cot (cot.id)}
						{@const items = (cot as any).cotizacion_items ?? []}
						{@const cliente = (cot as any).clientes}
						{@const creador = (cot as any).perfiles}
						{@const costoFab = items.reduce((s: number, i: any) => s + (i.precio_fabricacion ?? 0), 0)}
						<tr
							onclick={() => goto(`/cotizaciones/${cot.id}`)}
							class="cot-row cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors"
						>
							<td class="px-4 py-3">
								<p class="font-medium text-[var(--text)]">
									{cliente?.nombre ?? 'Sin cliente'}
								</p>
								{#if cliente?.empresa}
									<p class="text-[10px] text-[var(--text-dim)]">{cliente.empresa}</p>
								{/if}
								{#if creador}
									<p class="text-[10px] text-[var(--text-dim)]">por {creador.nombre}</p>
								{/if}
							</td>
							<td class="hidden px-4 py-3 lg:table-cell">
								<div class="flex flex-wrap gap-1">
									{#each items.slice(0, 3) as item}
										<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
											{item.tipo_label}
										</span>
									{/each}
									{#if items.length > 3}
										<span class="text-[10px] text-[var(--text-dim)]">+{items.length - 3}</span>
									{/if}
									{#if items.length === 0}
										<span class="text-[10px] text-[var(--text-dim)]">Sin items</span>
									{/if}
								</div>
							</td>
							{#if puedeVerCostos}
								<td class="hidden px-4 py-3 md:table-cell">
									<span class="text-[var(--warning)]">{fmt(costoFab)}</span>
								</td>
							{/if}
							<td class="hidden px-4 py-3 sm:table-cell">
								<span class="font-medium text-[var(--text)]">{fmt(cot.precio_total)}</span>
								{#if cot.descuento > 0}
									<span class="ml-1 text-[10px] text-[var(--text-dim)]">-{fmt(cot.descuento)}</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {estadoColor[cot.estado] ?? ''}">
									{estadoLabel[cot.estado] ?? cot.estado}
								</span>
							</td>
							<td class="hidden px-4 py-3 text-[var(--text-dim)] md:table-cell">
								{fmtRelativa(cot.created_at)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Paginación -->
	{#if totalPaginas > 1}
		<div class="mt-4 flex items-center justify-between text-sm">
			<p class="text-[var(--text-dim)]">Página {data.pagina} de {totalPaginas}</p>
			<div class="flex gap-1">
				<button
					onclick={() => irPagina(data.pagina - 1)}
					disabled={data.pagina <= 1}
					class="pag-btn rounded-lg px-3 py-1.5"
				>Anterior</button>
				<button
					onclick={() => irPagina(data.pagina + 1)}
					disabled={data.pagina >= totalPaginas}
					class="pag-btn rounded-lg px-3 py-1.5"
				>Siguiente</button>
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
	.btn-primary:hover {
		background: var(--brand-light);
	}

	.btn-secondary {
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.btn-secondary:hover {
		border-color: var(--border-light);
		color: var(--text);
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

	.filtro-btn {
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.filtro-btn:hover {
		border-color: var(--border-light);
		color: var(--text);
	}
	.filtro-activo {
		border-color: var(--brand) !important;
		color: var(--brand-light) !important;
		background: color-mix(in srgb, var(--brand) 10%, transparent);
	}

	.cot-row:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.pag-btn {
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.pag-btn:hover:not(:disabled) {
		border-color: var(--border-light);
		color: var(--text);
	}
	.pag-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>
