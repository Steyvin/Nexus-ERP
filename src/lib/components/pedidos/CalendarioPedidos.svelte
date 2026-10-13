<script lang="ts">
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { semaforoEntrega, progresoItems, resumenMaterial, diasHasta } from '$lib/utils/pedidos'

	let {
		pedidos = [],
		mes,
		puedeVerPrecios = false,
		onCambiarMes
	}: {
		pedidos: any[]
		/** Mes visible en formato YYYY-MM */
		mes: string
		puedeVerPrecios?: boolean
		onCambiarMes?: (mes: string) => void
	} = $props()

	const MESES = [
		'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
		'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
	]
	const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

	const anio = $derived(Number(mes.slice(0, 4)))
	const mesNum = $derived(Number(mes.slice(5, 7)))
	const titulo = $derived(`${MESES[mesNum - 1]} ${anio}`)

	// ── Compromisos del mes: entregar e instalar son días distintos ──
	type TipoEvento = 'entrega' | 'instalacion'

	interface Evento {
		pedido: any
		tipo: TipoEvento
	}

	const porDia = $derived.by(() => {
		const mapa = new Map<string, Evento[]>()
		const agregar = (iso: string, ev: Evento) => {
			const lista = mapa.get(iso) ?? []
			lista.push(ev)
			mapa.set(iso, lista)
		}

		for (const p of pedidos) {
			if (p.fecha_entrega) agregar(p.fecha_entrega.slice(0, 10), { pedido: p, tipo: 'entrega' })
			if (p.requiere_instalacion && p.fecha_instalacion) {
				agregar(p.fecha_instalacion.slice(0, 10), { pedido: p, tipo: 'instalacion' })
			}
		}

		// Dentro de un día: primero lo urgente, luego lo que ya está entregado
		for (const lista of mapa.values()) {
			lista.sort((a, b) => {
				const ea = a.pedido.fecha_entregado ? 1 : 0
				const eb = b.pedido.fecha_entregado ? 1 : 0
				if (ea !== eb) return ea - eb
				return (b.pedido.prioridad ?? 0) - (a.pedido.prioridad ?? 0)
			})
		}
		return mapa
	})

	// ── Rejilla del mes, con la semana empezando en lunes ──
	interface Celda {
		iso:     string
		dia:     number
		delMes:  boolean
		esHoy:   boolean
		eventos: Evento[]
	}

	function isoDe(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	}

	const hoyIso = isoDe(new Date())

	const celdas: Celda[] = $derived.by(() => {
		const primero = new Date(anio, mesNum - 1, 1)
		// getDay(): 0 = domingo. Convertir a lunes = 0
		const offset = (primero.getDay() + 6) % 7
		const diasDelMes = new Date(anio, mesNum, 0).getDate()
		const totalCeldas = Math.ceil((offset + diasDelMes) / 7) * 7

		const out: Celda[] = []
		for (let i = 0; i < totalCeldas; i++) {
			const fecha = new Date(anio, mesNum - 1, 1 - offset + i)
			const iso = isoDe(fecha)
			const delMes = fecha.getMonth() === mesNum - 1
			out.push({
				iso,
				dia: fecha.getDate(),
				delMes,
				esHoy: iso === hoyIso,
				eventos: delMes ? (porDia.get(iso) ?? []) : []
			})
		}
		return out
	})

	// Resumen del mes
	const totalEntregas = $derived(
		pedidos.filter((p) => p.fecha_entrega && p.fecha_entrega.slice(0, 7) === mes).length
	)
	const totalInstalaciones = $derived(
		pedidos.filter((p) => p.requiere_instalacion && p.fecha_instalacion && p.fecha_instalacion.slice(0, 7) === mes).length
	)
	const totalFacturado = $derived(
		pedidos
			.filter((p) => p.fecha_entrega && p.fecha_entrega.slice(0, 7) === mes)
			.reduce((s, p) => s + Number(p.precio_total ?? 0), 0)
	)

	// ── Navegación ──
	function desplazarMes(delta: number) {
		const d = new Date(anio, mesNum - 1 + delta, 1)
		onCambiarMes?.(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
	}

	function irHoy() {
		const d = new Date()
		onCambiarMes?.(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
	}

	// ── Día seleccionado: panel de detalle debajo de la rejilla ──
	let diaAbierto = $state<string | null>(null)

	const celdaAbierta = $derived(
		diaAbierto ? (celdas.find((c) => c.iso === diaAbierto) ?? null) : null
	)

	function abrirDia(c: Celda) {
		if (!c.delMes || c.eventos.length === 0) return
		diaAbierto = diaAbierto === c.iso ? null : c.iso
	}

	// Cuántos chips caben antes de resumir con "+N"
	const MAX_CHIPS = 3
</script>

<div class="mt-3">
	<!-- Cabecera: mes + navegación -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<button onclick={() => desplazarMes(-1)} class="nav-mes" title="Mes anterior" aria-label="Mes anterior">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<h2 class="min-w-[9rem] text-center text-base font-semibold capitalize text-[var(--text)]">
				{titulo}
			</h2>
			<button onclick={() => desplazarMes(1)} class="nav-mes" title="Mes siguiente" aria-label="Mes siguiente">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
			</button>
			<button onclick={irHoy} class="btn-hoy">Hoy</button>
		</div>

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-dim)]">
			<span><span class="font-medium text-[var(--text)]">{totalEntregas}</span> entrega{totalEntregas !== 1 ? 's' : ''}</span>
			{#if totalInstalaciones > 0}
				<span class="text-cyan-400">{totalInstalaciones} instalación{totalInstalaciones !== 1 ? 'es' : ''}</span>
			{/if}
			{#if puedeVerPrecios && totalFacturado > 0}
				<span>Total: <span class="font-medium text-[var(--text)]">{fmt(totalFacturado)}</span></span>
			{/if}
		</div>
	</div>

	<!-- Días de la semana -->
	<div class="mt-3 grid grid-cols-7 gap-1.5">
		{#each DIAS_CORTOS as d}
			<div class="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
				<span class="hidden sm:inline">{d}</span>
				<span class="sm:hidden">{d.charAt(0)}</span>
			</div>
		{/each}
	</div>

	<!-- Rejilla del mes -->
	<div class="grid grid-cols-7 gap-1.5">
		{#each celdas as c (c.iso)}
			{#if c.delMes && c.eventos.length > 0}
				<!-- Día con pedidos: se puede abrir para ver el detalle -->
				<div
					class="celda celda-clicable"
					class:celda-hoy={c.esHoy}
					class:celda-abierta={diaAbierto === c.iso}
					onclick={() => abrirDia(c)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDia(c) } }}
					role="button"
					tabindex="0"
					aria-label={`${c.dia} — ${c.eventos.length} compromiso${c.eventos.length !== 1 ? 's' : ''}`}
				>
					{@render contenidoCelda(c)}
				</div>
			{:else}
				<!-- Día vacío o de otro mes: solo decoración -->
				<div class="celda" class:celda-fuera={!c.delMes} class:celda-hoy={c.esHoy}>
					{@render contenidoCelda(c)}
				</div>
			{/if}
		{/each}
	</div>

	{#snippet contenidoCelda(c: Celda)}
			<!-- Número del día -->
			<div class="flex items-start justify-between gap-1">
					<span
						class="text-xs font-semibold {c.esHoy
							? 'flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[#080808]'
							: c.delMes
								? 'text-[var(--text-muted)]'
								: 'text-[var(--text-dim)] opacity-40'}"
					>{c.dia}</span>

					{#if c.eventos.length > MAX_CHIPS}
						<span class="shrink-0 rounded bg-[var(--bg-card-2)] px-1 text-[9px] text-[var(--text-dim)]">
							{c.eventos.length}
						</span>
					{/if}
				</div>

				<!-- Pedidos del día -->
				{#if c.eventos.length > 0}
					<div class="mt-1 space-y-1 overflow-hidden">
						{#each c.eventos.slice(0, MAX_CHIPS) as ev (ev.pedido.id + ev.tipo)}
							{@const p = ev.pedido}
							{@const sem = semaforoEntrega(
								ev.tipo === 'entrega' ? p.fecha_entrega : p.fecha_instalacion,
								p.fecha_entregado,
								p.estado
							)}
							{@const prod = progresoItems(p.pedido_items ?? [])}
							{@const mat = resumenMaterial(p.pedido_compras ?? [], p.fecha_entrega)}
							<a
								href="/pedidos/{p.id}"
								onclick={(e) => e.stopPropagation()}
								class="chip-pedido"
								class:chip-instalacion={ev.tipo === 'instalacion'}
								class:chip-entregado={!!p.fecha_entregado}
								title={`${p.clientes?.nombre ?? 'Sin cliente'} — ${ev.tipo === 'entrega' ? 'entrega' : 'instalación'} · ${p.estado} · ${prod.terminados}/${prod.total} items${mat.riesgo ? ' · material llega tarde' : ''}`}
							>
								<span class="h-1.5 w-1.5 shrink-0 rounded-full {sem.punto}"></span>
								{#if ev.tipo === 'instalacion'}
									<svg class="shrink-0 text-cyan-400" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
								{/if}
								<span class="truncate">{p.clientes?.nombre ?? 'Sin cliente'}</span>
								{#if mat.riesgo}
									<span class="shrink-0 text-red-400">⚠</span>
								{:else if prod.total > 0 && prod.pct === 100 && !p.fecha_entregado}
									<span class="shrink-0 text-green-400">✓</span>
								{/if}
							</a>
						{/each}

						{#if c.eventos.length > MAX_CHIPS}
							<span class="block px-1 text-[9px] font-medium text-[var(--brand-light)]">
								+{c.eventos.length - MAX_CHIPS} más
							</span>
						{/if}
					</div>
				{/if}
	{/snippet}

	<!-- Panel del día seleccionado -->
	{#if celdaAbierta && celdaAbierta.eventos.length > 0}
		{@const dias = diasHasta(celdaAbierta.iso)}
		<section class="mt-4 overflow-hidden rounded-xl border border-[var(--brand)]/30 bg-[var(--bg-card)]">
			<header class="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
				<h3 class="text-sm font-semibold text-[var(--text)]">
					{fmtFecha(celdaAbierta.iso)}
				</h3>
				<span class="text-[11px] text-[var(--text-dim)]">
					{#if dias === 0}hoy{:else if dias === 1}mañana{:else if dias !== null && dias < 0}hace {Math.abs(dias)} día{Math.abs(dias) > 1 ? 's' : ''}{:else if dias !== null}en {dias} días{/if}
					· {celdaAbierta.eventos.length} compromiso{celdaAbierta.eventos.length !== 1 ? 's' : ''}
				</span>
				<button
					onclick={() => (diaAbierto = null)}
					class="ml-auto text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
					title="Cerrar"
					aria-label="Cerrar detalle del día"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</header>

			<ul class="divide-y divide-[var(--border)]">
				{#each celdaAbierta.eventos as ev (ev.pedido.id + ev.tipo)}
					{@const p = ev.pedido}
					{@const items = p.pedido_items ?? []}
					{@const prod = progresoItems(items)}
					{@const mat = resumenMaterial(p.pedido_compras ?? [], p.fecha_entrega)}
					{@const listo = prod.total > 0 && prod.pct === 100}
					<li class="flex flex-wrap items-start gap-3 px-5 py-3">
						<span
							class="mt-0.5 shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide {ev.tipo === 'entrega'
								? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
								: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'}"
						>{ev.tipo === 'entrega' ? 'Entregar' : 'Instalar'}</span>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<a href="/pedidos/{p.id}" class="truncate text-sm font-medium text-[var(--text)] hover:text-[var(--brand-light)]">
									{p.clientes?.nombre ?? 'Sin cliente'}
								</a>
								<span class="rounded-full border px-2 py-0.5 text-[10px] {listo ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-[var(--border)] text-[var(--text-muted)]'}">
									{p.estado}
								</span>
								{#if p.fecha_entregado}
									<span class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
										entregado
									</span>
								{/if}
								{#if mat.riesgo}
									<span class="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
										material llega tarde
									</span>
								{/if}
							</div>
							<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-dim)]">
								<span>{prod.terminados}/{prod.total} items</span>
								{#if p.direccion_entrega}
									<span class="truncate">📍 {p.direccion_entrega}</span>
								{/if}
								{#if puedeVerPrecios}
									<span>{fmt(p.precio_total)}</span>
									{#if Number(p.saldo) > 0}
										<span class="text-[var(--warning)]">debe {fmt(p.saldo)}</span>
									{:else}
										<span class="text-green-400">pagado</span>
									{/if}
								{/if}
							</div>
						</div>

						{#if p.clientes?.contacto}
							<a
								href={`https://wa.me/${p.clientes.contacto.replace(/\D/g, '')}`}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-600/10 px-2.5 py-1 text-[11px] font-medium text-green-400 transition-colors hover:bg-green-600/20"
								title="Avisar por WhatsApp"
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
								Avisar
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Leyenda -->
	<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-[var(--text-dim)]">
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-red-500"></span> Vencido / hoy</span>
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500"></span> 1-2 días</span>
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-yellow-500"></span> Esta semana</span>
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-green-500"></span> Holgado</span>
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500"></span> Entregado</span>
		<span class="flex items-center gap-1.5 text-cyan-400">🔧 Instalación</span>
		<span class="flex items-center gap-1.5 text-red-400">⚠ Material llega tarde</span>
		<span class="flex items-center gap-1.5 text-green-400">✓ Listo para entregar</span>
	</div>
</div>

<style>
	.nav-mes {
		display: flex;
		height: 1.875rem;
		width: 1.875rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.nav-mes:hover {
		border-color: var(--border-light);
		color: var(--text);
	}

	.btn-hoy {
		margin-left: 0.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		padding: 0.25rem 0.75rem;
		font-size: 11px;
		color: var(--text-muted);
		background: transparent;
		transition: all 0.15s;
	}
	.btn-hoy:hover {
		border-color: var(--brand);
		color: var(--brand-light);
	}

	/* Cuadros grandes del mes. min-height en vez de aspect-ratio para que
	   nunca se corte el contenido cuando un día tiene varios pedidos. */
	.celda {
		display: flex;
		flex-direction: column;
		min-height: 6.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card);
		padding: 0.375rem;
		transition: border-color 0.15s, background 0.15s;
	}
	@media (min-width: 1024px) {
		.celda {
			min-height: 8.5rem;
			padding: 0.5rem;
		}
	}
	.celda-fuera {
		background: transparent;
		border-color: color-mix(in srgb, var(--border) 50%, transparent);
	}
	.celda-hoy {
		border-color: var(--brand);
	}
	.celda-clicable {
		cursor: pointer;
	}
	.celda-clicable:hover {
		border-color: var(--border-light);
		background: var(--bg-card-2);
	}
	.celda-abierta {
		border-color: var(--brand);
		background: color-mix(in srgb, var(--brand) 8%, transparent);
	}

	.chip-pedido {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 0.25rem;
		border: 1px solid var(--border);
		background: var(--bg-card-2);
		padding: 0.125rem 0.25rem;
		font-size: 10px;
		line-height: 1.3;
		color: var(--text-muted);
		transition: all 0.12s;
	}
	.chip-pedido:hover {
		border-color: var(--brand);
		color: var(--text);
	}
	.chip-instalacion {
		border-color: rgba(6, 182, 212, 0.3);
		background: rgba(6, 182, 212, 0.08);
	}
	.chip-entregado {
		opacity: 0.5;
	}
</style>
