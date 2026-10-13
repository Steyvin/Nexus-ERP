<script lang="ts">
	import { fmt } from '$lib/utils/format'
	import {
		progresoItems,
		resumenMaterial,
		semaforoEntrega,
		diasHasta
	} from '$lib/utils/pedidos'

	let {
		pedidos = [],
		puedeVerPrecios = false
	}: {
		pedidos: any[]
		puedeVerPrecios?: boolean
	} = $props()

	type TipoEvento = 'entrega' | 'instalacion'

	interface Evento {
		pedido: any
		tipo: TipoEvento
		fecha: string // YYYY-MM-DD
	}

	// Un pedido puede generar dos compromisos: entregar e instalar
	const eventos: Evento[] = $derived.by(() => {
		const out: Evento[] = []
		for (const p of pedidos) {
			if (p.fecha_entregado) continue // ya cerrado, no ocupa agenda
			if (p.fecha_entrega) {
				out.push({ pedido: p, tipo: 'entrega', fecha: p.fecha_entrega.slice(0, 10) })
			}
			if (p.requiere_instalacion && p.fecha_instalacion) {
				out.push({ pedido: p, tipo: 'instalacion', fecha: p.fecha_instalacion.slice(0, 10) })
			}
		}
		return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
	})

	// Pedidos sin ninguna fecha: son los que se vuelven problema callado
	const sinFecha = $derived(
		pedidos.filter((p) => !p.fecha_entregado && !p.fecha_entrega && !p.fecha_instalacion)
	)

	interface Grupo {
		clave:    string
		titulo:   string
		subtitulo: string
		vencido:  boolean
		hoy:      boolean
		eventos:  Evento[]
	}

	const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
	const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

	function tituloFecha(iso: string): { titulo: string; subtitulo: string } {
		const dias = diasHasta(iso) ?? 0
		const [y, m, d] = iso.split('-').map(Number)
		const fecha = new Date(y, m - 1, d)
		const legible = `${DIAS[fecha.getDay()]} ${d} ${MESES[m - 1]}`

		if (dias === 0) return { titulo: 'Hoy', subtitulo: legible }
		if (dias === 1) return { titulo: 'Mañana', subtitulo: legible }
		if (dias === -1) return { titulo: 'Ayer', subtitulo: legible }
		if (dias < 0) return { titulo: `Hace ${Math.abs(dias)} días`, subtitulo: legible }
		return { titulo: legible.charAt(0).toUpperCase() + legible.slice(1), subtitulo: `en ${dias} días` }
	}

	const grupos: Grupo[] = $derived.by(() => {
		const mapa = new Map<string, Evento[]>()
		for (const ev of eventos) {
			const lista = mapa.get(ev.fecha) ?? []
			lista.push(ev)
			mapa.set(ev.fecha, lista)
		}

		// Todo lo atrasado se junta arriba en un solo bloque rojo
		const atrasados: Evento[] = []
		const resto: Grupo[] = []

		for (const [fecha, evs] of [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
			const dias = diasHasta(fecha) ?? 0
			if (dias < 0) {
				atrasados.push(...evs)
				continue
			}
			const { titulo, subtitulo } = tituloFecha(fecha)
			resto.push({ clave: fecha, titulo, subtitulo, vencido: false, hoy: dias === 0, eventos: evs })
		}

		const salida: Grupo[] = []
		if (atrasados.length > 0) {
			salida.push({
				clave: '__atrasados',
				titulo: 'Atrasados',
				subtitulo: `${atrasados.length} compromiso${atrasados.length !== 1 ? 's' : ''} vencido${atrasados.length !== 1 ? 's' : ''}`,
				vencido: true,
				hoy: false,
				eventos: atrasados.sort((a, b) => a.fecha.localeCompare(b.fecha))
			})
		}
		return [...salida, ...resto]
	})
</script>

<div class="mt-3 space-y-4">
	{#if grupos.length === 0 && sinFecha.length === 0}
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-16 text-center text-sm text-[var(--text-dim)]">
			No hay entregas ni instalaciones agendadas
		</div>
	{/if}

	{#each grupos as g (g.clave)}
		<section
			class="overflow-hidden rounded-xl border bg-[var(--bg-card)]"
			class:borde-vencido={g.vencido}
			class:borde-hoy={g.hoy}
			class:borde-normal={!g.vencido && !g.hoy}
		>
			<header class="flex items-baseline gap-2 border-b border-[var(--border)] px-5 py-3">
				<h3 class="text-sm font-semibold {g.vencido ? 'text-red-400' : g.hoy ? 'text-amber-300' : 'text-[var(--text)]'}">
					{g.titulo}
				</h3>
				<span class="text-[11px] text-[var(--text-dim)]">{g.subtitulo}</span>
				<span class="ml-auto rounded-full bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
					{g.eventos.length}
				</span>
			</header>

			<ul class="divide-y divide-[var(--border)]">
				{#each g.eventos as ev (ev.pedido.id + ev.tipo)}
					{@const p = ev.pedido}
					{@const cliente = p.clientes}
					{@const items = p.pedido_items ?? []}
					{@const prod = progresoItems(items)}
					{@const mat = resumenMaterial(p.pedido_compras ?? [], p.fecha_entrega)}
					{@const listo = prod.total > 0 && prod.pct === 100}

					<li class="flex flex-wrap items-start gap-3 px-5 py-3">
						<!-- Tipo de compromiso -->
						<span
							class="mt-0.5 shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
							class:tipo-entrega={ev.tipo === 'entrega'}
							class:tipo-instalacion={ev.tipo === 'instalacion'}
						>{ev.tipo === 'entrega' ? 'Entregar' : 'Instalar'}</span>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<a
									href="/pedidos/{p.id}"
									class="truncate text-sm font-medium text-[var(--text)] hover:text-[var(--brand-light)]"
								>{cliente?.nombre ?? 'Sin cliente'}</a>
								<span class="rounded-full border px-2 py-0.5 text-[10px] {listo ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-[var(--border)] text-[var(--text-muted)]'}">
									{p.estado}
								</span>
								{#if !listo}
									<span class="text-[10px] text-[var(--text-dim)]">{prod.terminados}/{prod.total} items</span>
								{/if}
								{#if mat.riesgo}
									<span class="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
										material llega tarde
									</span>
								{/if}
							</div>

							<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-dim)]">
								{#if ev.tipo === 'instalacion' || p.direccion_entrega}
									<span class="truncate">
										{p.direccion_entrega || 'Sin dirección registrada'}
									</span>
								{/if}
								{#if cliente?.empresa}
									<span>{cliente.empresa}</span>
								{/if}
								{#if puedeVerPrecios && p.saldo > 0}
									<span class="text-[var(--warning)]">Debe {fmt(p.saldo)}</span>
								{/if}
							</div>
						</div>

						<!-- Contacto rápido: el día de la entrega se llama, no se escribe correo -->
						{#if cliente?.contacto}
							<a
								href={`https://wa.me/${cliente.contacto.replace(/\D/g, '')}`}
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
	{/each}

	<!-- Pedidos sin fecha: el agujero negro de la operación -->
	{#if sinFecha.length > 0}
		<section class="overflow-hidden rounded-xl border border-dashed border-[var(--border-light)] bg-[var(--bg-card)]">
			<header class="flex items-baseline gap-2 border-b border-[var(--border)] px-5 py-3">
				<h3 class="text-sm font-semibold text-[var(--text-muted)]">Sin fecha de entrega</h3>
				<span class="text-[11px] text-[var(--text-dim)]">no aparecen en ninguna agenda</span>
				<span class="ml-auto rounded-full bg-[var(--bg-card-2)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
					{sinFecha.length}
				</span>
			</header>
			<ul class="divide-y divide-[var(--border)]">
				{#each sinFecha as p (p.id)}
					<li class="flex items-center gap-3 px-5 py-2.5">
						<a href="/pedidos/{p.id}" class="min-w-0 flex-1 truncate text-sm text-[var(--text)] hover:text-[var(--brand-light)]">
							{p.clientes?.nombre ?? 'Sin cliente'}
						</a>
						<span class="shrink-0 text-[10px] text-[var(--text-dim)]">{p.estado}</span>
						<a href="/pedidos/{p.id}" class="shrink-0 text-[10px] text-[var(--brand-light)] hover:underline">
							Poner fecha
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.borde-normal  { border-color: var(--border); }
	.borde-vencido { border-color: rgba(239, 68, 68, 0.4); }
	.borde-hoy     { border-color: rgba(245, 158, 11, 0.4); }

	.tipo-entrega {
		border-color: rgba(59, 130, 246, 0.3);
		background: rgba(59, 130, 246, 0.1);
		color: #60a5fa;
	}
	.tipo-instalacion {
		border-color: rgba(6, 182, 212, 0.3);
		background: rgba(6, 182, 212, 0.1);
		color: #22d3ee;
	}
</style>
