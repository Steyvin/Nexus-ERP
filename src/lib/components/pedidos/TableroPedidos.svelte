<script lang="ts">
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { ESTADOS_PEDIDO } from '$lib/types'
	import {
		progresoItems,
		progresoDisenos,
		resumenMaterial,
		semaforoEntrega,
		estadoDesfasado,
		ordenarPorUrgencia,
		clasePrioridad
	} from '$lib/utils/pedidos'

	let {
		pedidos = [],
		puedeVerPrecios = false,
		puedeMover = false,
		onMover
	}: {
		pedidos: any[]
		puedeVerPrecios?: boolean
		puedeMover?: boolean
		onMover?: (pedidoId: string, estado: string) => void
	} = $props()

	// Color de cada columna
	const colorColumna: Record<string, { punto: string; texto: string }> = {
		'Pedido realizado':    { punto: 'bg-yellow-500',  texto: 'text-yellow-400' },
		'En proceso':          { punto: 'bg-orange-500',  texto: 'text-orange-400' },
		'Enviado a proveedor': { punto: 'bg-purple-500',  texto: 'text-purple-400' },
		'En fabricación':      { punto: 'bg-blue-500',    texto: 'text-blue-400' },
		'Terminado':           { punto: 'bg-green-500',   texto: 'text-green-400' },
		'Entregado':           { punto: 'bg-emerald-500', texto: 'text-emerald-400' }
	}

	// Movimiento optimista: la tarjeta salta de columna antes de que responda el servidor
	let overrides = $state<Record<string, string>>({})

	const conEstado = $derived(
		pedidos.map((p) => ({ ...p, _estado: overrides[p.id] ?? p.estado }))
	)

	// Al llegar datos frescos, soltar los overrides que el servidor ya confirmó
	$effect(() => {
		for (const p of pedidos) {
			if (overrides[p.id] && overrides[p.id] === p.estado) {
				delete overrides[p.id]
			}
		}
	})

	const columnas = $derived(
		ESTADOS_PEDIDO.map((estado) => ({
			estado,
			pedidos: ordenarPorUrgencia(conEstado.filter((p) => p._estado === estado))
		}))
	)

	// ── Drag & drop ──
	let arrastrando = $state<string | null>(null)
	let columnaActiva = $state<string | null>(null)

	function iniciarArrastre(e: DragEvent, pedidoId: string) {
		if (!puedeMover) return
		arrastrando = pedidoId
		e.dataTransfer?.setData('text/plain', pedidoId)
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
	}

	function soltar(e: DragEvent, estado: string) {
		e.preventDefault()
		columnaActiva = null
		const id = e.dataTransfer?.getData('text/plain') || arrastrando
		arrastrando = null
		if (!id || !puedeMover) return

		const actual = conEstado.find((p) => p.id === id)
		if (!actual || actual._estado === estado) return

		overrides[id] = estado
		onMover?.(id, estado)
	}

	function sobreColumna(e: DragEvent, estado: string) {
		if (!puedeMover) return
		e.preventDefault()
		columnaActiva = estado
	}

	function mover(pedidoId: string, estado: string) {
		overrides[pedidoId] = estado
		onMover?.(pedidoId, estado)
	}
</script>

<div class="tablero mt-3 flex gap-3 overflow-x-auto pb-4">
	{#each columnas as col (col.estado)}
		{@const c = colorColumna[col.estado] ?? { punto: 'bg-gray-500', texto: 'text-gray-400' }}
		<section
			class="columna"
			class:columna-activa={columnaActiva === col.estado}
			ondragover={(e) => sobreColumna(e, col.estado)}
			ondragleave={() => (columnaActiva = null)}
			ondrop={(e) => soltar(e, col.estado)}
			role="list"
			aria-label={col.estado}
		>
			<!-- Cabecera de columna -->
			<header class="flex items-center gap-2 px-1 pb-2">
				<span class="h-2 w-2 shrink-0 rounded-full {c.punto}"></span>
				<h3 class="flex-1 truncate text-xs font-semibold {c.texto}">{col.estado}</h3>
				<span class="rounded-full bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
					{col.pedidos.length}
				</span>
			</header>

			<div class="space-y-2">
				{#each col.pedidos as pedido (pedido.id)}
					{@const cliente = pedido.clientes}
					{@const items = pedido.pedido_items ?? []}
					{@const compras = pedido.pedido_compras ?? []}
					{@const prod = progresoItems(items)}
					{@const dis = progresoDisenos(items)}
					{@const mat = resumenMaterial(compras, pedido.fecha_entrega)}
					{@const sem = semaforoEntrega(pedido.fecha_entrega, pedido.fecha_entregado, pedido._estado)}
					{@const desfase = estadoDesfasado({ ...pedido, estado: pedido._estado }, items, compras)}

					<article
						class="tarjeta rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
						class:tarjeta-arrastre={arrastrando === pedido.id}
						draggable={puedeMover}
						ondragstart={(e) => iniciarArrastre(e, pedido.id)}
						ondragend={() => { arrastrando = null; columnaActiva = null }}
						role="listitem"
					>
						<!-- Barra de urgencia -->
						<div class="mb-2 flex items-center gap-2">
							<span class="h-1.5 w-1.5 shrink-0 rounded-full {sem.punto}"></span>
							<a
								href="/pedidos/{pedido.id}"
								class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)] hover:text-[var(--brand-light)]"
							>{cliente?.nombre ?? 'Sin cliente'}</a>
							{#if pedido.prioridad > 0}
								<span class="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase {clasePrioridad(pedido.prioridad)}">
									{pedido.prioridad === 2 ? 'Urgente' : 'Alta'}
								</span>
							{/if}
						</div>

						<!-- Semáforo de entrega -->
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="rounded border px-1.5 py-0.5 text-[10px] font-medium {sem.clase}">
								{sem.label}
							</span>
							{#if pedido.requiere_instalacion}
								<span
									class="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400"
									title={pedido.fecha_instalacion ? `Instalación: ${fmtFecha(pedido.fecha_instalacion)}` : 'Instalación sin agendar'}
								>
									<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
									Instala{pedido.fecha_instalacion ? ` ${fmtFecha(pedido.fecha_instalacion).slice(0, 6)}` : ''}
								</span>
							{/if}
						</div>

						<!-- Chips de avance real -->
						<div class="mt-2 flex flex-wrap gap-1">
							<span
								class="chip {dis.total > 0 && dis.terminados === dis.total ? 'chip-ok' : dis.terminados > 0 ? 'chip-medio' : 'chip-off'}"
								title="Diseños completados"
							>🎨 {dis.terminados}/{dis.total}</span>

							<span
								class="chip {mat.estado === 'completo' ? 'chip-ok' : mat.riesgo ? 'chip-alerta' : mat.estado === 'sin_registrar' ? 'chip-off' : 'chip-medio'}"
								title={mat.estado === 'sin_registrar'
									? 'No se registró material para este pedido'
									: mat.riesgo
										? 'El material llega después de la fecha de entrega'
										: mat.label}
							>📦 {mat.estado === 'sin_registrar' ? '—' : `${mat.recibidos}/${mat.total}`}{mat.riesgo ? ' ⚠' : ''}</span>

							<span
								class="chip {prod.pct === 100 ? 'chip-ok' : prod.terminados > 0 ? 'chip-medio' : 'chip-off'}"
								title="Items terminados"
							>🔧 {prod.terminados}/{prod.total}</span>
						</div>

						<!-- Progreso -->
						<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-card-2)]">
							<div
								class="h-full rounded-full transition-all {prod.pct === 100 ? 'bg-green-500' : 'bg-[var(--brand)]'}"
								style="width: {prod.pct}%"
							></div>
						</div>

						<!-- Aviso de desfase: los items van por delante del estado -->
						{#if desfase}
							<p class="mt-2 flex items-start gap-1 text-[10px] text-amber-400/90" title="El estado guardado no coincide con el avance de los items">
								<svg class="mt-px shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
								Debería estar en "{desfase}"
							</p>
						{/if}

						<!-- Pie: plata + mover. Envuelve si la columna queda angosta -->
						<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
							{#if puedeVerPrecios}
								<div class="min-w-0 flex-1 text-[10px] leading-tight">
									<span class="text-[var(--text-muted)]">{fmt(pedido.precio_total)}</span>
									{#if pedido.saldo > 0}
										<span class="text-[var(--warning)]"> · debe {fmt(pedido.saldo)}</span>
									{:else}
										<span class="text-green-400"> · pagado</span>
									{/if}
								</div>
							{:else}
								<div class="min-w-0 flex-1 truncate text-[10px] text-[var(--text-dim)]">
									{items.length} item{items.length !== 1 ? 's' : ''}
								</div>
							{/if}

							{#if puedeMover}
								<!-- Fallback táctil: en móvil arrastrar no sirve -->
								<select
									value={pedido._estado}
									onchange={(e) => mover(pedido.id, (e.currentTarget as HTMLSelectElement).value)}
									class="select-mover shrink-0"
									title="Mover a otra etapa"
									aria-label="Mover pedido a otra etapa"
								>
									{#each ESTADOS_PEDIDO as est}
										<option value={est}>{est}</option>
									{/each}
								</select>
							{/if}
						</div>
					</article>
				{/each}

				{#if col.pedidos.length === 0}
					<div class="rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-[10px] text-[var(--text-dim)]">
						Vacío
					</div>
				{/if}
			</div>
		</section>
	{/each}
</div>

<style>
	/* Móvil y tablet: columnas de ancho fijo, se navega con scroll horizontal */
	.columna {
		flex: 0 0 15rem;
		border-radius: 0.75rem;
		border: 1px solid transparent;
		padding: 0.5rem;
		transition: background 0.15s, border-color 0.15s;
	}

	/* Escritorio: las columnas se reparten el ancho disponible y entran todas.
	   `min-width` evita que se compriman hasta ser ilegibles — si no caben,
	   reaparece el scroll en vez de encoger el contenido. */
	@media (min-width: 1024px) {
		.tablero {
			gap: 0.5rem;
		}
		.columna {
			flex: 1 1 0;
			min-width: 10rem;
			padding: 0.5rem 0.375rem;
		}
	}
	.columna-activa {
		border-color: var(--brand);
		background: color-mix(in srgb, var(--brand) 6%, transparent);
	}

	.tarjeta {
		cursor: grab;
		transition: border-color 0.15s, transform 0.1s;
	}
	.tarjeta:hover {
		border-color: var(--border-light);
	}
	.tarjeta-arrastre {
		opacity: 0.4;
		transform: scale(0.98);
	}

	.chip {
		border-radius: 0.25rem;
		border: 1px solid var(--border);
		padding: 0.0625rem 0.3125rem;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.chip-ok {
		border-color: rgba(34, 197, 94, 0.3);
		background: rgba(34, 197, 94, 0.1);
		color: #4ade80;
	}
	.chip-medio {
		border-color: rgba(59, 130, 246, 0.3);
		background: rgba(59, 130, 246, 0.1);
		color: #60a5fa;
	}
	.chip-alerta {
		border-color: rgba(239, 68, 68, 0.4);
		background: rgba(239, 68, 68, 0.12);
		color: #f87171;
	}
	.chip-off {
		color: var(--text-dim);
	}

	.select-mover {
		max-width: 100%;
		width: 6.5rem;
		border-radius: 0.375rem;
		border: 1px solid var(--border);
		background: var(--bg-card-2);
		padding: 0.125rem 0.25rem;
		font-size: 10px;
		color: var(--text-muted);
		outline: none;
	}
	.select-mover:focus {
		border-color: var(--brand);
	}

	@media (max-width: 640px) {
		.columna {
			flex: 0 0 13.5rem;
		}
	}
</style>
