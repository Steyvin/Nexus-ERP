<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { totalItems } from '$lib/stores/carrito'
	import { fmt, fmtRelativa } from '$lib/utils/format'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const estados = [
		{ val: null, label: 'Todas' },
		{ val: 'pendiente', label: 'Pendientes' },
		{ val: 'aprobada', label: 'Aprobadas' },
		{ val: 'convertida', label: 'Convertidas' },
		{ val: 'cancelada', label: 'Canceladas' }
	]

	const estadoColor: Record<string, string> = {
		pendiente: 'bg-yellow-500/15 text-yellow-400',
		aprobada: 'bg-green-500/15 text-green-400',
		convertida: 'bg-blue-500/15 text-blue-400',
		cancelada: 'bg-red-500/15 text-red-400'
	}

	const estadoLabel: Record<string, string> = {
		pendiente: 'Pendiente',
		aprobada: 'Aprobada',
		convertida: 'Convertida',
		cancelada: 'Cancelada'
	}

	function cambiarFiltro(val: string | null) {
		const params = new URLSearchParams($page.url.searchParams)
		if (val) params.set('estado', val)
		else params.delete('estado')
		params.delete('p')
		goto(`?${params}`)
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

	<!-- Filtros -->
	<div class="mt-4 flex gap-1 overflow-x-auto">
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

	<!-- Lista -->
	<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
		{#if data.cotizaciones.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				No hay cotizaciones{data.filtroEstado ? ' con ese estado' : ''}
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
						<th class="px-4 py-3 font-medium">Cliente</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Total</th>
						<th class="px-4 py-3 font-medium">Estado</th>
						<th class="hidden px-4 py-3 font-medium md:table-cell">Fecha</th>
					</tr>
				</thead>
				<tbody>
					{#each data.cotizaciones as cot (cot.id)}
						<tr class="cot-row cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors">
							<td class="px-4 py-3">
								<p class="font-medium text-[var(--text)]">
									{(cot.clientes as any)?.nombre ?? 'Sin cliente'}
								</p>
							</td>
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
