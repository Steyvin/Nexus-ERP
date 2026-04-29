<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page, navigating } from '$app/stores'
	import { fade } from 'svelte/transition'
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
	import { fmt } from '$lib/utils/format'
	import type { PageData } from './$types'

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

	let { data }: { data: PageData } = $props()

	const p    = $derived(data.periodo)
	const mA   = $derived(data.mesActual)
	const mAnt = $derived(data.mesAnterior)
	const items = $derived(data.itemsPeriodo)

	let comparativoModo = $state<'mensual' | 'semanal'>('mensual')
	const compActual = $derived(comparativoModo === 'mensual' ? mA : data.semanaActual)
	const compAnterior = $derived(comparativoModo === 'mensual' ? mAnt : data.semanaAnterior)
	const compLabelActual = $derived(comparativoModo === 'mensual' ? data.nombreMesActual : 'Esta semana')
	const compLabelAnterior = $derived(comparativoModo === 'mensual' ? data.nombreMesAnterior : 'Semana pasada')
	const compTitulo = $derived(comparativoModo === 'mensual' ? 'Comparativo mensual' : 'Comparativo semanal')

	// ── Filtro de fechas ───────────────────────────────────────────────────
	let mostrarFechas   = $state(!!(data.fechaDesde || data.fechaHasta))
	let modoPersonalizado = $state(!!(data.fechaDesde || data.fechaHasta))
	let fechaDesde      = $state(data.fechaDesde ?? '')
	let fechaHasta      = $state(data.fechaHasta ?? '')

	let expandido = $state<string | null>(null)

	function isoLocal(d: Date): string {
		const y = d.getFullYear()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const day = String(d.getDate()).padStart(2, '0')
		return `${y}-${m}-${day}`
	}
	function isoHoy()    { return isoLocal(new Date()) }
	function isoLunes()  {
		const d = new Date(); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
		d.setDate(d.getDate() + diff); return isoLocal(d)
	}
	function isoDomingo() {
		const d = new Date(); const diff = d.getDay() === 0 ? 0 : 7 - d.getDay()
		d.setDate(d.getDate() + diff); return isoLocal(d)
	}

	function aplicarParams(overrides: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams)
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v); else params.delete(k)
		}
		goto(`?${params}`)
	}

	function isoInicioMes(): string {
		const d = new Date(); d.setDate(1); return isoLocal(d)
	}

	function isoFinMes(): string {
		const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return isoLocal(d)
	}

	function aplicarHoy() {
		const d = isoHoy(); fechaDesde = d; fechaHasta = d
		modoPersonalizado = false
		aplicarParams({ desde: d, hasta: d })
	}
	function aplicarSemana() {
		const desde = isoLunes(); const hasta = isoDomingo()
		fechaDesde = desde; fechaHasta = hasta
		modoPersonalizado = false
		aplicarParams({ desde, hasta })
	}
	function aplicarMes() {
		const desde = isoInicioMes(); const hasta = isoFinMes()
		fechaDesde = desde; fechaHasta = hasta
		modoPersonalizado = false
		aplicarParams({ desde, hasta })
	}
	function aplicarPersonalizado() {
		aplicarParams({ desde: fechaDesde || null, hasta: fechaHasta || null })
	}
	function limpiarFechas() {
		fechaDesde = ''; fechaHasta = ''
		modoPersonalizado = false; mostrarFechas = false
		aplicarParams({ desde: null, hasta: null })
	}

	const MESES_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

	const periodoLabel = $derived.by(() => {
		if (!data.fechaDesde && !data.fechaHasta) return 'Semana actual'
		const hoy = isoHoy(); const lun = isoLunes(); const dom = isoDomingo()
		const ini = isoInicioMes(); const fin = isoFinMes()
		if (data.fechaDesde === hoy && data.fechaHasta === hoy) return 'Hoy'
		if (data.fechaDesde === lun && data.fechaHasta === dom) return 'Esta semana'
		if (data.fechaDesde === ini && data.fechaHasta === fin) {
			const d = new Date(); return `${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`
		}
		const d1 = data.fechaDesde ? new Date(data.fechaDesde + 'T12:00:00') : null
		const d2 = data.fechaHasta ? new Date(data.fechaHasta + 'T12:00:00') : null
		if (d1 && d2) return `${d1.getDate()} ${MESES_FULL[d1.getMonth()]} – ${d2.getDate()} ${MESES_FULL[d2.getMonth()]} ${d2.getFullYear()}`
		if (d1) return `Desde ${d1.getDate()} ${MESES_FULL[d1.getMonth()]}`
		if (d2) return `Hasta ${d2.getDate()} ${MESES_FULL[d2.getMonth()]}`
		return 'Período personalizado'
	})

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

	<!-- ═══ KPIs — PERÍODO SELECCIONADO ═══ -->
	<div class="mt-5">
		<!-- Encabezado + filtro de período -->
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-dim)]">{periodoLabel}</p>
				{#if data.fechaDesde || data.fechaHasta}
					<button onclick={limpiarFechas} class="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline">Limpiar</button>
				{/if}
			</div>
			<div class="flex items-center gap-1.5">
				<button
					onclick={aplicarHoy}
					class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text)] transition-colors"
					class:filtro-activo={data.fechaDesde === isoHoy() && data.fechaHasta === isoHoy()}
				>Hoy</button>
				<button
					onclick={aplicarSemana}
					class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text)] transition-colors"
					class:filtro-activo={data.fechaDesde === isoLunes() && data.fechaHasta === isoDomingo()}
				>Esta semana</button>
				<button
					onclick={aplicarMes}
					class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text)] transition-colors"
					class:filtro-activo={data.fechaDesde === isoInicioMes() && data.fechaHasta === isoFinMes()}
				>Este mes</button>
				<button
					onclick={() => { mostrarFechas = !mostrarFechas; if (mostrarFechas) modoPersonalizado = true }}
					class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text)] transition-colors"
					class:filtro-activo={modoPersonalizado}
				>
					<svg class="inline-block" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
					Personalizado
				</button>
			</div>
		</div>

		<!-- Panel de fechas personalizadas -->
		{#if mostrarFechas && modoPersonalizado}
			<div class="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Desde</label>
					<input type="date" bind:value={fechaDesde} class="input-field text-sm" />
				</div>
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Hasta</label>
					<input type="date" bind:value={fechaHasta} class="input-field text-sm" />
				</div>
				<button onclick={aplicarPersonalizado} class="btn-primary rounded-lg px-4 py-2 text-sm">Aplicar</button>
				<button onclick={() => mostrarFechas = false} class="text-xs text-[var(--text-dim)] hover:text-[var(--text)]">Cerrar</button>
			</div>
		{/if}

		<!-- Barra de carga -->
		<div class="mb-3 h-0.5 overflow-hidden rounded-full">
			{#if $navigating}
				<div class="h-full w-full animate-[carga_1.2s_ease-in-out_infinite] bg-[var(--brand)]"></div>
			{/if}
		</div>

		{#key data.periodo}
		<div in:fade={{ duration: 180 }}>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">

			<!-- Ventas brutas -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Ventas brutas</p>
					<div class="rounded-lg bg-[var(--brand)]/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da74d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--text)]">{fmt(p.ventas)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">{p.pedidos} pedido{p.pedidos !== 1 ? 's' : ''}</p>
			</div>

			<!-- Costo fabricación -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Costo fabricación</p>
					<div class="rounded-lg bg-orange-500/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8a03a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--warning)]">{fmt(p.costo)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
					{p.ventas > 0 ? Math.round((p.costo / p.ventas) * 100) : 0}% del total
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
				<p class="mt-2 text-lg font-bold text-[var(--brand-light)]">{fmt(p.ganancia)}</p>
				<p class="mt-0.5 text-[10px] text-[var(--brand-light)]/60">{p.margen}% margen</p>
			</div>

			<!-- Pedidos -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
				<div class="flex items-center justify-between">
					<p class="text-[11px] text-[var(--text-dim)]">Pedidos</p>
					<div class="rounded-lg bg-blue-500/10 p-1.5">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a0f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
					</div>
				</div>
				<p class="mt-2 text-lg font-bold text-[var(--text)]">{p.pedidos}</p>
				<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">{periodoLabel.toLowerCase()}</p>
			</div>
			</div>
		</div>

		<!-- ═══ DETALLE DE PRODUCTOS DEL PERÍODO ═══ -->
		<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
			<div class="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
				<div>
					<h2 class="text-sm font-medium text-[var(--text)]">Detalle de productos</h2>
					<p class="text-[11px] text-[var(--text-dim)]">Productos registrados en {periodoLabel.toLowerCase()}</p>
				</div>
				<span class="rounded-full bg-[var(--bg-card-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
					{items.length} items
				</span>
			</div>

			{#if items.length === 0}
				<div class="px-5 py-8 text-center text-sm text-[var(--text-dim)]">
					No hay productos en este período
				</div>
			{:else}
				<div class="overflow-x-auto max-h-[400px] overflow-y-auto">
					<table class="w-full text-sm relative">
						<thead class="sticky top-0 bg-[var(--bg-card)] z-10 shadow-sm">
							<tr class="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
								<th class="px-5 py-3 font-medium">Producto</th>
								<th class="px-5 py-3 font-medium">Cliente</th>
								<th class="px-5 py-3 font-medium">Estado</th>
								<th class="px-5 py-3 font-medium text-right">Costo Venta</th>
								<th class="px-5 py-3 font-medium text-right">Costo Fab.</th>
								<th class="px-5 py-3 font-medium text-right">Ganancia</th>
								<th class="px-5 py-3 font-medium text-right">Margen</th>
							</tr>
						</thead>
						<tbody>
							{#each items as item (item.id)}
								{@const venta = Number(item.precio_cliente ?? 0)}
								{@const fab = Number(item.precio_fabricacion ?? 0)}
								{@const ganancia = venta - fab}
								{@const margen = venta > 0 ? Math.round((ganancia / venta) * 100) : 0}
								{@const estadoCls = item.estado_produccion === 'terminado' ? 'bg-green-500/10 text-green-400' : item.estado_produccion === 'en_fabricacion' ? 'bg-blue-500/10 text-blue-400' : 'bg-yellow-500/10 text-yellow-400'}
								<tr onclick={() => expandido = expandido === item.id ? null : item.id} class="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-2)] transition-colors cursor-pointer">
									<td class="px-5 py-3 font-medium text-[var(--text)]">
										<div class="flex items-center gap-2">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-dim)] transition-transform {expandido === item.id ? 'rotate-90' : ''}"><polyline points="9 18 15 12 9 6"/></svg>
											{item.tipo_label || 'Producto'}
										</div>
									</td>
									<td class="px-5 py-3 text-[var(--text-dim)]">{item.cliente_nombre || 'Sin cliente'}</td>
									<td class="px-5 py-3">
										<span class="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize {estadoCls}">
											{item.estado_produccion ? item.estado_produccion.replace('_', ' ') : 'pendiente'}
										</span>
									</td>
									<td class="px-5 py-3 text-right text-[var(--text)]">{fmt(venta)}</td>
									<td class="px-5 py-3 text-right text-[var(--warning)]">{fmt(fab)}</td>
									<td class="px-5 py-3 text-right text-[var(--brand-light)]">{fmt(ganancia)}</td>
									<td class="px-5 py-3 text-right">
										<span class="rounded-full px-2 py-0.5 text-[10px] font-medium
											{margen >= 30 ? 'bg-green-500/10 text-green-400' : margen >= 15 ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'}
										">
											{margen}%
										</span>
									</td>
								</tr>
								{#if expandido === item.id}
									<tr class="border-b border-[var(--border)] bg-[var(--bg-card-2)]/30">
										<td colspan="7" class="px-5 py-3">
											<div class="flex items-center justify-between">
												<span class="text-xs text-[var(--text-dim)]">Ver toda la información y estado de este pedido.</span>
												<a href="/pedidos/{item.pedido_id}" class="btn-primary rounded-lg px-4 py-1.5 text-xs font-medium">Ver detalle</a>
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
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

	<!-- ═══ COMPARATIVO ═══ -->
	<div class="mt-6">
		<div class="mb-3 flex items-center justify-between">
			<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-dim)]">{compTitulo}</p>
			<div class="flex items-center gap-1 rounded-lg bg-[var(--bg-card-2)] p-1">
				<button onclick={() => comparativoModo = 'mensual'} class="rounded px-2.5 py-1 text-[10px] font-medium transition-colors {comparativoModo === 'mensual' ? 'bg-[var(--bg-card)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}">Mensual</button>
				<button onclick={() => comparativoModo = 'semanal'} class="rounded px-2.5 py-1 text-[10px] font-medium transition-colors {comparativoModo === 'semanal' ? 'bg-[var(--bg-card)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}">Semanal</button>
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">

			<!-- Período actual -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-medium capitalize text-[var(--text)]">{compLabelActual}</h2>
					<span class="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--brand-light)]">Actual</span>
				</div>
				<dl class="space-y-3">
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Ventas brutas</dt>
						<dd class="text-sm font-semibold text-[var(--text)]">{fmt(compActual.ventas)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Costo fabricación</dt>
						<dd class="text-sm font-semibold text-[var(--warning)]">{fmt(compActual.costo)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Ganancia neta</dt>
						<dd class="text-sm font-semibold text-[var(--brand-light)]">{fmt(compActual.ganancia)}</dd>
					</div>
					<div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
						<dt class="text-xs text-[var(--text-muted)]">Pedidos</dt>
						<dd class="text-sm font-semibold text-[var(--text)]">{compActual.pedidos}</dd>
					</div>
					<div class="flex items-center justify-between">
						<dt class="text-xs text-[var(--text-muted)]">Margen</dt>
						<dd class="text-sm font-semibold {compActual.margen >= 30 ? 'text-[var(--brand-light)]' : compActual.margen >= 15 ? 'text-[var(--warning)]' : 'text-red-400'}">{compActual.margen}%</dd>
					</div>
				</dl>
			</div>

			<!-- Período anterior + variación -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-medium capitalize text-[var(--text)]">{compLabelAnterior}</h2>
					<span class="rounded-full bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">Anterior</span>
				</div>
				<dl class="space-y-3">
					{#each [
						{ label: 'Ventas brutas',       actual: compActual.ventas,   anterior: compAnterior.ventas,   fmt: true  },
						{ label: 'Costo fabricación',   actual: compActual.costo,    anterior: compAnterior.costo,    fmt: true  },
						{ label: 'Ganancia neta',       actual: compActual.ganancia, anterior: compAnterior.ganancia, fmt: true  },
						{ label: 'Pedidos',             actual: compActual.pedidos,  anterior: compAnterior.pedidos,  fmt: false },
						{ label: 'Margen',              actual: compActual.margen,   anterior: compAnterior.margen,   fmt: false, sufijo: '%' }
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
	{/key}
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

	.filtro-activo {
		background: var(--brand) !important;
		color: #080808 !important;
		border-color: var(--brand) !important;
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
	.input-field:focus { border-color: var(--brand); }

	@keyframes carga {
		0%   { transform: translateX(-100%); }
		50%  { transform: translateX(0%); }
		100% { transform: translateX(100%); }
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
