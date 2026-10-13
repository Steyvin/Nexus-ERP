<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { ESTADOS_COMPRA, ESTADO_COMPRA_LABEL } from '$lib/types'
	import type { EstadoCompra } from '$lib/types'
	import { diasHasta } from '$lib/utils/pedidos'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const esAdmin = $derived(data.rol === 'admin')
	const esFinanzas = $derived(data.rol === 'finanzas')
	const puedeVerPrecios = $derived(esAdmin || esFinanzas)
	const puedeCrearProveedor = $derived(esAdmin || esFinanzas)

	const compraEstadoColor: Record<string, string> = {
		por_pedir:        'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
		pedido:           'bg-purple-500/15 text-purple-400 border-purple-500/30',
		recibido_parcial: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		recibido:         'bg-green-500/15 text-green-400 border-green-500/30'
	}

	interface Grupo {
		id:        string
		nombre:    string
		contacto:  string | null
		compras:   any[]
		riesgos:   number
		porPedir:  number
		costo:     number
	}

	// Agrupar por proveedor: así se hace UNA llamada por proveedor, no cinco
	const grupos: Grupo[] = $derived.by(() => {
		const mapa = new Map<string, Grupo>()

		for (const c of data.compras) {
			const prov = (c as any).proveedores
			const id = prov?.id ?? '__sin'
			let g = mapa.get(id)
			if (!g) {
				g = {
					id,
					nombre: prov?.nombre ?? 'Sin proveedor asignado',
					contacto: prov?.contacto ?? null,
					compras: [],
					riesgos: 0,
					porPedir: 0,
					costo: 0
				}
				mapa.set(id, g)
			}
			g.compras.push(c)
			g.costo += Number(c.costo_real ?? 0)
			if (c.estado === 'por_pedir') g.porPedir++
			const entrega = (c as any).pedidos?.fecha_entrega
			if (c.estado !== 'recibido' && c.fecha_estimada && entrega && c.fecha_estimada > entrega) {
				g.riesgos++
			}
		}

		// Primero quien tiene material que llega tarde, luego quien tiene más por pedir
		return [...mapa.values()].sort((a, b) => {
			if (a.riesgos !== b.riesgos) return b.riesgos - a.riesgos
			if (a.porPedir !== b.porPedir) return b.porPedir - a.porPedir
			return a.nombre.localeCompare(b.nombre)
		})
	})

	const totalRiesgos = $derived(grupos.reduce((s, g) => s + g.riesgos, 0))
	const totalPendientes = $derived(data.compras.length)

	let creandoProveedor = $state(false)
	let provNombre = $state('')
	let provContacto = $state('')
	let provMateriales = $state('')

	function alternarTodo() {
		goto(data.verTodo ? '/material' : '/material?todo=1')
	}

	function mensajeProveedor(g: Grupo): string {
		const pendientes = g.compras.filter((c) => c.estado === 'por_pedir')
		const lista = (pendientes.length > 0 ? pendientes : g.compras)
			.map((c) => `- ${c.material}${c.cantidad ? ` (${c.cantidad})` : ''}`)
			.join('\n')
		return encodeURIComponent(`Hola ${g.nombre}, necesito cotizar / pedir:\n${lista}`)
	}
</script>

<svelte:head>
	<title>Material y proveedores — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Material</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				{totalPendientes} registro{totalPendientes !== 1 ? 's' : ''}
				{#if data.verTodo}
					<span class="text-[var(--text-dim)]">· incluyendo recibidos</span>
				{:else}
					<span class="text-[var(--text-dim)]">· pendientes, agrupados por proveedor</span>
				{/if}
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button onclick={alternarTodo} class="btn-secondary rounded-lg px-3 py-2 text-xs">
				{data.verTodo ? 'Solo pendientes' : 'Ver todo'}
			</button>
			{#if puedeCrearProveedor}
				<button
					onclick={() => (creandoProveedor = true)}
					class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					Nuevo proveedor
				</button>
			{/if}
		</div>
	</div>

	{#if data.errorCarga}
		<div class="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm text-red-400">
			<p class="font-medium">No se pudo cargar el material</p>
			<p class="mt-1 text-xs opacity-80">{data.errorCarga}</p>
			<p class="mt-2 text-xs opacity-80">
				Si habla de una tabla o columna que no existe, vuelve a correr
				<code>supabase/migration_pedidos_flujo.sql</code> completo en Supabase → SQL Editor.
				Es idempotente: se puede correr de nuevo sin daño.
			</p>
		</div>
	{/if}

	<!-- Alerta global: material que llega después de la entrega prometida -->
	{#if totalRiesgos > 0}
		<div class="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
			<svg class="mt-0.5 shrink-0 text-red-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
			<div>
				<p class="text-sm font-medium text-red-300">
					{totalRiesgos} material{totalRiesgos !== 1 ? 'es' : ''} llega después de la entrega prometida
				</p>
				<p class="mt-0.5 text-xs text-red-400/80">
					Mueve la fecha con el cliente o busca otro proveedor antes de que sea tarde.
				</p>
			</div>
		</div>
	{/if}

	<!-- Grupos por proveedor -->
	<div class="mt-4 space-y-4">
		{#if grupos.length === 0 && !data.errorCarga}
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-16 text-center">
				<p class="text-sm text-[var(--text-dim)]">
					{data.verTodo ? 'No hay material registrado' : 'No hay material pendiente'}
				</p>
				<p class="mx-auto mt-1 max-w-md text-xs text-[var(--text-dim)]">
					El material se registra dentro de cada pedido, en la sección "Material y proveedores".
				</p>
			</div>
		{/if}

		{#each grupos as g (g.id)}
			<section class="overflow-hidden rounded-xl border bg-[var(--bg-card)] {g.riesgos > 0 ? 'border-red-500/30' : 'border-[var(--border)]'}">
				<header class="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-3">
					<div class="min-w-0 flex-1">
						<h2 class="truncate text-sm font-semibold {g.id === '__sin' ? 'text-amber-400' : 'text-[var(--text)]'}">
							{g.nombre}
						</h2>
						<p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--text-dim)]">
							<span>{g.compras.length} material{g.compras.length !== 1 ? 'es' : ''}</span>
							{#if g.porPedir > 0}
								<span class="text-yellow-400">· {g.porPedir} por pedir</span>
							{/if}
							{#if g.riesgos > 0}
								<span class="text-red-400">· {g.riesgos} llega tarde</span>
							{/if}
							{#if puedeVerPrecios && g.costo > 0}
								<span class="text-[var(--warning)]">· {fmt(g.costo)}</span>
							{/if}
						</p>
					</div>

					{#if g.contacto}
						<a
							href={`https://wa.me/${g.contacto.replace(/\D/g, '')}?text=${mensajeProveedor(g)}`}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/20"
							title="Escribir al proveedor con la lista"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
							Pedir todo
						</a>
					{/if}
				</header>

				<ul class="divide-y divide-[var(--border)]">
					{#each g.compras as c (c.id)}
						{@const ped = (c as any).pedidos}
						{@const tarde = c.estado !== 'recibido' && c.fecha_estimada && ped?.fecha_entrega && c.fecha_estimada > ped.fecha_entrega}
						{@const dias = c.estado !== 'recibido' ? diasHasta(c.fecha_estimada) : null}
						<li class="flex flex-wrap items-start gap-3 px-5 py-3">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-medium text-[var(--text)]">{c.material}</span>
									{#if c.cantidad}
										<span class="text-[11px] text-[var(--text-dim)]">{c.cantidad}</span>
									{/if}
									<span class="rounded-full border px-2 py-0.5 text-[10px] font-medium {compraEstadoColor[c.estado] ?? ''}">
										{ESTADO_COMPRA_LABEL[c.estado as EstadoCompra] ?? c.estado}
									</span>
									{#if tarde}
										<span class="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
											llega tarde
										</span>
									{/if}
									{#if Number(ped?.prioridad ?? 0) > 0}
										<span class="rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase {Number(ped.prioridad) === 2 ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-orange-500/35 bg-orange-500/15 text-orange-400'}">
											{Number(ped.prioridad) === 2 ? 'Urgente' : 'Alta'}
										</span>
									{/if}
								</div>

								<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-dim)]">
									<a href="/pedidos/{c.pedido_id}" class="text-[var(--brand-light)] hover:underline">
										{ped?.clientes?.nombre ?? 'Pedido'}
									</a>
									{#if ped?.fecha_entrega}
										<span>entrega {fmtFecha(ped.fecha_entrega)}</span>
									{/if}
									{#if c.fecha_estimada && c.estado !== 'recibido'}
										<span class={tarde ? 'text-red-400' : ''}>
											llega {fmtFecha(c.fecha_estimada)}{#if dias !== null}
												· {dias < 0 ? `atrasado ${Math.abs(dias)}d` : dias === 0 ? 'hoy' : `en ${dias}d`}
											{/if}
										</span>
									{:else if c.estado !== 'recibido'}
										<span class="text-amber-400/80">sin fecha de llegada</span>
									{/if}
									{#if c.fecha_recibido}
										<span class="text-green-400">recibido {fmtFecha(c.fecha_recibido)}</span>
									{/if}
									{#if puedeVerPrecios && Number(c.costo_real) > 0}
										<span class="text-[var(--warning)]">{fmt(c.costo_real)}</span>
									{/if}
								</div>
							</div>

							<form method="POST" action="?/actualizarCompra" use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										mostrarToast('Material actualizado')
										invalidateAll()
									} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
										mostrarToast(result.data.error, 'error')
									}
								}
							}} class="flex shrink-0 items-center gap-2">
								<input type="hidden" name="pedido_id" value={c.pedido_id} />
								<input type="hidden" name="compra_id" value={c.id} />
								<select
									name="estado"
									onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
									class="input-field rounded-lg py-1 text-xs"
									aria-label="Estado del material"
								>
									{#each ESTADOS_COMPRA as e}
										<option value={e} selected={c.estado === e}>{ESTADO_COMPRA_LABEL[e]}</option>
									{/each}
								</select>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</div>

<!-- Modal: Nuevo proveedor -->
{#if creandoProveedor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (creandoProveedor = false)}>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--text)]">Nuevo proveedor</h3>

			<form method="POST" action="?/crearProveedor" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Proveedor creado')
						creandoProveedor = false
						provNombre = ''
						provContacto = ''
						provMateriales = ''
						invalidateAll()
					} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
						mostrarToast(result.data.error, 'error')
					}
				}
			}} class="mt-4 space-y-3">
				<div>
					<label for="pn" class="mb-1 block text-[10px] text-[var(--text-muted)]">Nombre *</label>
					<input id="pn" type="text" name="nombre" bind:value={provNombre} required class="input-field w-full" />
				</div>
				<div>
					<label for="pc" class="mb-1 block text-[10px] text-[var(--text-muted)]">Teléfono / WhatsApp</label>
					<input id="pc" type="text" name="contacto" bind:value={provContacto} class="input-field w-full" />
				</div>
				<div>
					<label for="pm" class="mb-1 block text-[10px] text-[var(--text-muted)]">Qué vende</label>
					<input
						id="pm"
						type="text"
						name="materiales"
						bind:value={provMateriales}
						placeholder="Acrílico, PVC, LED, vinilo..."
						class="input-field w-full"
					/>
				</div>
				<div class="flex justify-end gap-2 pt-1">
					<button
						type="button"
						onclick={() => (creandoProveedor = false)}
						class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button
						type="submit"
						disabled={!provNombre.trim()}
						class="btn-primary rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-40"
					>Crear</button>
				</div>
			</form>
		</div>
	</div>
{/if}

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
</style>
