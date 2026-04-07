<script lang="ts">
	import { onMount } from 'svelte'
	import { invalidateAll } from '$app/navigation'
	import { usuario } from '$lib/stores/auth'
	import { fmt, fmtRelativa } from '$lib/utils/format'
	import BarChart from '$lib/components/ui/BarChart.svelte'
	import { supabase } from '$lib/supabase'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// Suscripción en tiempo real: refrescar datos al cambiar pedidos o cotizaciones
	onMount(() => {
		const channel = supabase
			.channel('dashboard-realtime')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
				invalidateAll()
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' }, () => {
				invalidateAll()
			})
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	})

	const estadoColor: Record<string, string> = {
		'Pedido realizado': 'estado-nuevo',
		'En proceso': 'estado-proceso',
		'Enviado a proveedor': 'estado-proveedor',
		'En fabricación': 'estado-fabricacion',
		Terminado: 'estado-terminado',
		Entregado: 'estado-entregado'
	}
</script>

<svelte:head>
	<title>Dashboard — Nexus LED</title>
</svelte:head>

<div>
	<h1 class="text-xl font-semibold text-[var(--text)]">Dashboard</h1>
	<p class="mt-1 text-sm text-[var(--text-muted)]">
		Bienvenido, {$usuario?.nombre ?? 'Usuario'}
	</p>

	<!-- KPI Cards -->
	<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Ventas de la semana -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<div class="flex items-center gap-2">
				<span class="kpi-icon kpi-icon-green flex h-8 w-8 items-center justify-center rounded-lg">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
				</span>
				<p class="text-sm text-[var(--text-muted)]">Ventas esta semana</p>
			</div>
			<p class="mt-3 text-2xl font-semibold text-[var(--text)]">{fmt(data.ventasSemana)}</p>
		</div>

		<!-- Cotizaciones pendientes -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<div class="flex items-center gap-2">
				<span class="kpi-icon kpi-icon-yellow flex h-8 w-8 items-center justify-center rounded-lg">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
				</span>
				<p class="text-sm text-[var(--text-muted)]">Cotizaciones pendientes</p>
			</div>
			<p class="mt-3 text-2xl font-semibold text-[var(--text)]">{data.cotizacionesPendientes}</p>
		</div>

		<!-- Pedidos en producción -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<div class="flex items-center gap-2">
				<span class="kpi-icon kpi-icon-blue flex h-8 w-8 items-center justify-center rounded-lg">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
				</span>
				<p class="text-sm text-[var(--text-muted)]">En producción</p>
			</div>
			<p class="mt-3 text-2xl font-semibold text-[var(--text)]">{data.pedidosProduccion}</p>
		</div>

		<!-- Entregados este mes -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<div class="flex items-center gap-2">
				<span class="kpi-icon kpi-icon-green flex h-8 w-8 items-center justify-center rounded-lg">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
				</span>
				<p class="text-sm text-[var(--text-muted)]">Entregados este mes</p>
			</div>
			<p class="mt-3 text-2xl font-semibold text-[var(--text)]">{data.pedidosEntregadosMes}</p>
		</div>
	</div>

	<!-- Gráfico + Pedidos recientes -->
	<div class="mt-6 grid gap-4 lg:grid-cols-5">
		<!-- Gráfico de ventas -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 lg:col-span-3">
			<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Ventas — Últimas 8 semanas</h2>
			<div class="h-[280px]">
				<BarChart
					labels={data.ventasPorSemana.map((s) => s.label)}
					data={data.ventasPorSemana.map((s) => s.total)}
				/>
			</div>
		</div>

		<!-- Pedidos recientes -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 lg:col-span-2">
			<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Pedidos recientes</h2>

			{#if data.pedidosRecientes.length === 0}
				<p class="py-8 text-center text-sm text-[var(--text-dim)]">Sin pedidos aún</p>
			{:else}
				<ul class="space-y-1">
					{#each data.pedidosRecientes as pedido}
						<li>
							<a
								href="/pedidos/{pedido.id}"
								class="pedido-row flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm text-[var(--text)]">
										{(pedido.clientes as any)?.nombre ?? 'Sin cliente'}
									</p>
									<p class="text-xs text-[var(--text-dim)]">
										{fmtRelativa(pedido.created_at)}
									</p>
								</div>
								<div class="flex flex-col items-end gap-1">
									<span class="text-sm font-medium text-[var(--text)]">
										{fmt(pedido.precio_total)}
									</span>
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-medium {estadoColor[pedido.estado] ?? 'estado-nuevo'}"
									>
										{pedido.estado}
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.kpi-icon-green {
		background: color-mix(in srgb, var(--success) 15%, transparent);
		color: var(--success);
	}
	.kpi-icon-yellow {
		background: color-mix(in srgb, var(--warning) 15%, transparent);
		color: var(--warning);
	}
	.kpi-icon-blue {
		background: color-mix(in srgb, #5b9bd5 15%, transparent);
		color: #5b9bd5;
	}

	.pedido-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	:global(.estado-nuevo) {
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-muted);
	}
	:global(.estado-proceso) {
		background: color-mix(in srgb, #5b9bd5 15%, transparent);
		color: #5b9bd5;
	}
	:global(.estado-proveedor) {
		background: color-mix(in srgb, #a78bfa 15%, transparent);
		color: #a78bfa;
	}
	:global(.estado-fabricacion) {
		background: color-mix(in srgb, var(--warning) 15%, transparent);
		color: var(--warning);
	}
	:global(.estado-terminado) {
		background: color-mix(in srgb, var(--success) 15%, transparent);
		color: var(--success);
	}
	:global(.estado-entregado) {
		background: color-mix(in srgb, var(--brand) 20%, transparent);
		color: var(--brand-light);
	}
</style>
