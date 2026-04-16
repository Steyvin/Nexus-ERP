<script lang="ts">
	import { onMount } from 'svelte'
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
	import { fmt } from '$lib/utils/format'
	import type { PageData } from './$types'

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

	let { data }: { data: PageData } = $props()

	const s   = $derived(data.semanaActual)
	const mA  = $derived(data.mesActual)
	const mAnt = $derived(data.mesAnterior)

	// ── Gráfico ventas vs ganancias ────────────────────────────────────────
	let canvas: HTMLCanvasElement
	let chart: Chart | null = null

	const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

	const chartLabels  = $derived(data.semanas.map((s) => {
		const d = new Date(s.semana_inicio + 'T12:00:00')
		return `${d.getDate()} ${MESES[d.getMonth()]}`
	}))
	const chartVentas   = $derived(data.semanas.map((s) => Number(s.ventas_brutas ?? 0)))
	const chartGanancias = $derived(data.semanas.map((s) => Number(s.ganancia_bruta ?? 0)))

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: chartLabels,
				datasets: [
					{
						label: 'Ventas brutas',
						data: chartVentas,
						backgroundColor: '#2d7a2d',
						hoverBackgroundColor: '#4da74d',
						borderRadius: 5,
						barPercentage: 0.65,
						categoryPercentage: 0.75
					},
					{
						label: 'Ganancia neta',
						data: chartGanancias,
						backgroundColor: '#1a4060',
						hoverBackgroundColor: '#2a60a0',
						borderRadius: 5,
						barPercentage: 0.65,
						categoryPercentage: 0.75
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'top',
						align: 'end',
						labels: { color: '#666666', boxWidth: 12, padding: 16, font: { size: 11 } }
					},
					tooltip: {
						backgroundColor: '#111111',
						borderColor: '#222222',
						borderWidth: 1,
						titleColor: '#f0f0f0',
						bodyColor: '#aaaaaa',
						padding: 10,
						cornerRadius: 8,
						callbacks: {
							label(ctx) {
								return ` ${ctx.dataset.label}: $${(ctx.parsed.y ?? 0).toLocaleString('es-CO')}`
							}
						}
					}
				},
				scales: {
					x: {
						border: { display: false },
						grid: { display: false },
						ticks: { color: '#666666', font: { size: 10 } }
					},
					y: {
						border: { display: false },
						grid: { color: '#1a1a1a' },
						ticks: {
							color: '#444444',
							font: { size: 10 },
							callback(value) {
								if (typeof value === 'number') {
									if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
									if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
								}
								return value
							}
						}
					}
				}
			}
		})
		return () => chart?.destroy()
	})

	$effect(() => {
		if (chart) {
			chart.data.labels = chartLabels
			chart.data.datasets[0].data = chartVentas
			chart.data.datasets[1].data = chartGanancias
			chart.update()
		}
	})

	// ── Utilidades ─────────────────────────────────────────────────────────
	function variacion(actual: number, anterior: number): number {
		if (anterior === 0) return actual > 0 ? 100 : 0
		return Math.round(((actual - anterior) / anterior) * 100)
	}

	function exportarPDF() {
		window.print()
	}
</script>

<svelte:head>
	<title>Reportes — Nexus LED</title>
</svelte:head>

<div>
	<!-- ═══ CABECERA ═══ -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:mb-4">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Reportes financieros</h1>
			<p class="mt-0.5 text-xs text-[var(--text-dim)]">Datos calculados desde pedidos activos y entregados</p>
		</div>
		<button
			onclick={exportarPDF}
			class="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium print:hidden"
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
				<rect x="6" y="14" width="12" height="8"/>
			</svg>
			Exportar PDF
		</button>
	</div>

	<!-- ═══ KPIs — SEMANA ACTUAL ═══ -->
	<div class="mt-5">
		<p class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--text-dim)]">Semana actual</p>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">

			<!-- Ventas brutas -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Ventas brutas</p>
					<div class="rounded-lg bg-[var(--brand)]/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da74d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--text)]">{fmt(s.ventas_brutas)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">{s.total_pedidos} pedido{s.total_pedidos !== 1 ? 's' : ''}</p>
			</div>

			<!-- Costo fabricación -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Costo fabricación</p>
					<div class="rounded-lg bg-orange-500/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8a03a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--warning)]">{fmt(s.costo_fabricacion)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
					{s.ventas_brutas > 0 ? Math.round((s.costo_fabricacion / s.ventas_brutas) * 100) : 0}% del total
				</p>
			</div>

			<!-- Ganancia neta -->
			<div class="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--brand-light)]">Ganancia neta</p>
					<div class="rounded-lg bg-[var(--brand)]/20 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da74d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--brand-light)]">{fmt(s.ganancia_bruta)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--brand-light)]/60">
					{s.ventas_brutas > 0 ? Math.round((s.ganancia_bruta / s.ventas_brutas) * 100) : 0}% margen
				</p>
			</div>

			<!-- Pedidos -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Pedidos</p>
					<div class="rounded-lg bg-blue-500/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a0f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--text)]">{s.total_pedidos}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">esta semana</p>
			</div>
		</div>
	</div>

	<!-- ═══ GRÁFICO VENTAS VS GANANCIAS (12 semanas) ═══ -->
	<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="text-sm font-medium text-[var(--text)]">Ventas vs Ganancias</h2>
				<p class="text-[11px] text-[var(--text-dim)]">Últimas 12 semanas</p>
			</div>
		</div>
		{#if data.semanas.length === 0}
			<div class="flex h-44 items-center justify-center text-sm text-[var(--text-dim)]">
				Sin datos suficientes aún
			</div>
		{:else}
			<div class="h-52">
				<canvas bind:this={canvas}></canvas>
			</div>
		{/if}
	</div>

	<!-- ═══ COMPARATIVO MENSUAL ═══ -->
	<div class="mt-6">
		<p class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--text-dim)]">Comparativo mensual</p>
		<div class="grid gap-4 sm:grid-cols-2">

			<!-- Mes actual -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-medium capitalize text-[var(--text)]">{data.nombreMesActual}</h2>
					<span class="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--brand-light)]">Actual</span>
				</div>
				<dl class="space-y-3">
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Ventas brutas</dt>
						<dd class="text-sm font-semibold text-[var(--text)]">{fmt(mA.ventas)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Costo fabricación</dt>
						<dd class="text-sm font-semibold text-[var(--warning)]">{fmt(mA.costo)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Ganancia neta</dt>
						<dd class="text-sm font-semibold text-[var(--brand-light)]">{fmt(mA.ganancia)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Pedidos</dt>
						<dd class="text-sm font-semibold text-[var(--text)]">{mA.pedidos}</dd>
					</div>
					<div class="flex items-center justify-between">
						<dt class="text-xs text-[var(--text-muted)]">Margen</dt>
						<dd class="text-sm font-semibold {mA.margen >= 30 ? 'text-[var(--brand-light)]' : mA.margen >= 15 ? 'text-[var(--warning)]' : 'text-red-400'}">{mA.margen}%</dd>
					</div>
				</dl>
			</div>

			<!-- Mes anterior + variación -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-medium capitalize text-[var(--text)]">{data.nombreMesAnterior}</h2>
					<span class="rounded-full bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">Anterior</span>
				</div>
				<dl class="space-y-3">
					{#each [
						{ label: 'Ventas brutas',       actual: mA.ventas,   anterior: mAnt.ventas,   fmt: true  },
						{ label: 'Costo fabricación',   actual: mA.costo,    anterior: mAnt.costo,    fmt: true  },
						{ label: 'Ganancia neta',       actual: mA.ganancia, anterior: mAnt.ganancia, fmt: true  },
						{ label: 'Pedidos',             actual: mA.pedidos,  anterior: mAnt.pedidos,  fmt: false },
						{ label: 'Margen',              actual: mA.margen,   anterior: mAnt.margen,   fmt: false, sufijo: '%' }
					] as fila, i}
						{@const pct = variacion(fila.actual, fila.anterior)}
						{@const sube = pct > 0}
						{@const baja = pct < 0}
						{@const esCosto = i === 1}
						<div class="flex items-center justify-between {i < 4 ? 'border-b border-[var(--border)] pb-3' : ''}">
							<dt class="text-xs text-[var(--text-muted)]">{fila.label}</dt>
							<dd class="flex items-center gap-2">
								<span class="text-xs text-[var(--text-dim)]">
									{fila.fmt ? fmt(fila.anterior) : fila.anterior}{fila.sufijo ?? ''}
								</span>
								{#if pct !== 0}
									<span class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium
										{(sube && !esCosto) || (baja && esCosto) ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
									">
										{#if sube}
											<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>
										{:else}
											<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
										{/if}
										{Math.abs(pct)}%
									</span>
								{:else}
									<span class="text-[10px] text-[var(--text-dim)]">—</span>
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</div>
		</div>
	</div>

	<!-- ═══ PRODUCTOS MÁS VENDIDOS ═══ -->
	<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
		<div class="border-b border-[var(--border)] px-5 py-3">
			<h2 class="text-sm font-medium text-[var(--text)]">Productos más vendidos</h2>
			<p class="text-[11px] text-[var(--text-dim)]">Solo pedidos Terminados y Entregados</p>
		</div>

		{#if data.productosTop.length === 0}
			<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">
				Aún no hay pedidos terminados o entregados para generar el ranking
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
							<th class="px-5 py-3 font-medium">#</th>
							<th class="px-5 py-3 font-medium">Producto</th>
							<th class="px-5 py-3 font-medium text-right">Unidades</th>
							<th class="px-5 py-3 font-medium text-right">Ingresos</th>
							<th class="px-5 py-3 font-medium text-right">Costo fab.</th>
							<th class="px-5 py-3 font-medium text-right">Ganancia</th>
							<th class="px-5 py-3 font-medium text-right">Margen</th>
						</tr>
					</thead>
					<tbody>
						{#each data.productosTop as prod, idx (prod.tipo_label)}
							{@const margen = Number(prod.margen_promedio_pct ?? 0)}
							<tr class="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-2)] transition-colors">
								<td class="px-5 py-3 text-[var(--text-dim)]">{idx + 1}</td>
								<td class="px-5 py-3 font-medium text-[var(--text)]">{prod.tipo_label}</td>
								<td class="px-5 py-3 text-right text-[var(--text-muted)]">{prod.cantidad_vendida}</td>
								<td class="px-5 py-3 text-right text-[var(--text)]">{fmt(Number(prod.ingresos_totales))}</td>
								<td class="px-5 py-3 text-right text-[var(--warning)]">{fmt(Number(prod.costos_totales))}</td>
								<td class="px-5 py-3 text-right text-[var(--brand-light)]">{fmt(Number(prod.ganancia_total))}</td>
								<td class="px-5 py-3 text-right">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium
										{margen >= 30 ? 'bg-green-500/10 text-green-400' : margen >= 15 ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'}
									">
										{margen}%
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Pie de página al imprimir -->
	<div class="mt-8 hidden text-center text-xs text-[var(--text-dim)] print:block">
		Nexus LED ERP — Reporte generado el {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
	</div>
</div>

<style>
	.btn-primary {
		background: var(--brand);
		color: #080808;
		transition: background 0.15s;
	}
	.btn-primary:hover {
		background: var(--brand-light);
	}

	/* ── Estilos de impresión ── */
	@media print {
		:global(aside),
		:global(header),
		:global(nav) {
			display: none !important;
		}
		:global(main) {
			padding: 0 !important;
			margin: 0 !important;
		}
		:global(body) {
			background: white !important;
			color: black !important;
			font-size: 11px;
		}
	}
</style>
