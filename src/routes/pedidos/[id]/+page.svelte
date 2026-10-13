<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha, fmtRelativa } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { subirImagenComprimida } from '$lib/utils/upload'
	import { ESTADOS_PEDIDO, ESTADO_ITEM_LABEL, ESTADOS_COMPRA, ESTADO_COMPRA_LABEL } from '$lib/types'
	import type { EstadoItem, EstadoCompra } from '$lib/types'
	import { semaforoEntrega, resumenMaterial, estadoDesfasado, diasHasta } from '$lib/utils/pedidos'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const ped = $derived(data.pedido)
	const cliente = $derived((ped as any).clientes)
	const creador = $derived((ped as any).perfiles)
	const items = $derived((ped as any).pedido_items ?? [])
	const notas = $derived((ped as any).pedido_notas ?? [])
	const compras = $derived((ped as any).pedido_compras ?? [])
	const proveedores = $derived(data.proveedores ?? [])

	const esAdmin = $derived(data.rol === 'admin')
	const esFinanzas = $derived(data.rol === 'finanzas')
	const esFabricador = $derived(data.rol === 'fabricador')
	const esDiseñador = $derived(data.rol === 'diseñador')
	const puedeVerPrecios = $derived(esAdmin || esFinanzas)
	const puedeEditarEstadoItems = $derived(esAdmin || esFabricador)
	const puedeGestionarAbonos = $derived(esAdmin || esFinanzas)
	const abonos = $derived(data.abonos ?? [])
	const bancos = $derived(data.bancos ?? [])

	// Cálculos
	const costoFab = $derived(items.reduce((s: number, i: any) => s + Number(i.precio_fabricacion ?? 0), 0))
	const totalCliente = $derived(items.reduce((s: number, i: any) => s + Number(i.precio_cliente ?? 0), 0))
	const terminados = $derived(items.filter((i: any) => i.estado_produccion === 'terminado').length)
	const enFabricacion = $derived(items.filter((i: any) => i.estado_produccion === 'en_fabricacion').length)
	const pendientes = $derived(items.filter((i: any) => i.estado_produccion === 'pendiente').length)
	const pctProgreso = $derived(items.length > 0 ? Math.round((terminados / items.length) * 100) : 0)
	const disenosHechos = $derived(items.filter((i: any) => i.diseno_completado).length)
	const pctDisenos = $derived(items.length > 0 ? Math.round((disenosHechos / items.length) * 100) : 0)
	const ganancia = $derived(totalCliente - costoFab)
	const margenPct = $derived(totalCliente > 0 ? Math.round((ganancia / totalCliente) * 100) : 0)

	// ── Entrega, instalación y material ──
	const sem = $derived(semaforoEntrega(ped.fecha_entrega, ped.fecha_entregado, ped.estado))
	const semInstalacion = $derived(
		ped.requiere_instalacion ? semaforoEntrega(ped.fecha_instalacion, ped.fecha_entregado, ped.estado) : null
	)
	const mat = $derived(resumenMaterial(compras, ped.fecha_entrega))
	const desfase = $derived(estadoDesfasado(ped, items, compras))
	const entregado = $derived(!!ped.fecha_entregado || ped.estado === 'Entregado')
	const listoParaEntregar = $derived(items.length > 0 && pctProgreso === 100 && !entregado)

	// Costo real del material comprado vs. lo que estimó la calculadora
	const costoMaterialReal = $derived(
		compras.reduce((s: number, c: any) => s + Number(c.costo_real ?? 0), 0)
	)

	const compraEstadoColor: Record<string, string> = {
		por_pedir:        'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
		pedido:           'bg-purple-500/15 text-purple-400 border-purple-500/30',
		recibido_parcial: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		recibido:         'bg-green-500/15 text-green-400 border-green-500/30'
	}

	const estadoColor: Record<string, string> = {
		'Pedido realizado': 'bg-yellow-500/15 text-yellow-400',
		'En proceso': 'bg-orange-500/15 text-orange-400',
		'Enviado a proveedor': 'bg-purple-500/15 text-purple-400',
		'En fabricación': 'bg-blue-500/15 text-blue-400',
		'Terminado': 'bg-green-500/15 text-green-400',
		'Entregado': 'bg-emerald-500/15 text-emerald-400'
	}

	const itemEstadoColor: Record<string, string> = {
		pendiente: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
		en_fabricacion: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		terminado: 'bg-green-500/15 text-green-400 border-green-500/30'
	}

	// Estado UI
	let subiendoDiseno = $state<string | null>(null)
	let urlDiseno = $state('')
	let descripcionDiseno = $state('')
	let nuevaNota = $state('')
	let editandoInfo = $state(false)
	let editFechaEntrega = $state('')
	let editNota = $state('')
	let editRequiereInstalacion = $state(false)
	let editDireccion = $state('')
	let editFechaInstalacion = $state('')
	let editPrioridad = $state(0)

	// Material: alta de compras y de proveedores
	let agregandoMaterial = $state(false)
	let matMaterial = $state('')
	let matCantidad = $state('')
	let matProveedor = $state('')
	let matItem = $state('')
	let matCosto = $state(0)
	let matEstado = $state<EstadoCompra>('por_pedir')
	let matFechaEstimada = $state('')
	let creandoProveedor = $state(false)
	let provNombre = $state('')
	let provContacto = $state('')
	let provMateriales = $state('')

	// Entrega
	let confirmandoEntrega = $state(false)
	let fotoEntrega = $state('')

	function limpiarMaterial() {
		matMaterial = ''
		matCantidad = ''
		matProveedor = ''
		matItem = ''
		matCosto = 0
		matEstado = 'por_pedir'
		matFechaEstimada = ''
	}

	let anadiendoAbono = $state(false)
	let nuevoMontoAbono = $state(0)

	// Abonos
	let agregandoAbono = $state(false)
	let abonoMonto = $state(0)
	let abonoConcepto = $state('')
	let abonoBanco = $state('')
	const saldoPendiente = $derived(Math.max(0, Number(ped.precio_total ?? 0) - Number(ped.abono ?? 0)))

	// Sincroniza los campos del formulario con el pedido cuando no se está editando
	$effect(() => {
		if (!editandoInfo) {
			editFechaEntrega = ped.fecha_entrega ?? ''
			editNota = ped.nota ?? ''
			editRequiereInstalacion = !!ped.requiere_instalacion
			editDireccion = ped.direccion_entrega ?? ''
			editFechaInstalacion = ped.fecha_instalacion ?? ''
			editPrioridad = Number(ped.prioridad ?? 0)
		}
	})

	// Detectar tipo de nota para iconos en el timeline
	type TipoNota = 'estado' | 'diseno' | 'asignacion' | 'edicion' | 'abono' | 'material' | 'entrega' | 'nota'

	function tipoNota(contenido: string): TipoNota {
		if (contenido.startsWith('[Estado]')) return 'estado'
		if (contenido.startsWith('[Diseño]')) return 'diseno'
		if (contenido.startsWith('[Asignación]')) return 'asignacion'
		if (contenido.startsWith('[Edición]')) return 'edicion'
		if (contenido.startsWith('[Abono]')) return 'abono'
		if (contenido.startsWith('[Material]')) return 'material'
		if (contenido.startsWith('[Entrega]')) return 'entrega'
		return 'nota'
	}

	function limpiarPrefijo(contenido: string): string {
		return contenido.replace(/^\[(Estado|Diseño|Asignación|Edición|Abono|Material|Entrega)\]\s*/, '')
	}

	// Colores del timeline por tipo de nota
	const notaEstilo: Record<TipoNota, { halo: string; punto: string; chip: string; label: string }> = {
		estado:     { halo: 'bg-blue-500/20',   punto: 'bg-blue-400',   chip: 'bg-blue-500/10 text-blue-400',     label: 'Estado' },
		diseno:     { halo: 'bg-purple-500/20', punto: 'bg-purple-400', chip: 'bg-purple-500/10 text-purple-400', label: 'Diseño' },
		asignacion: { halo: 'bg-orange-500/20', punto: 'bg-orange-400', chip: 'bg-orange-500/10 text-orange-400', label: 'Asignación' },
		edicion:    { halo: 'bg-yellow-500/20', punto: 'bg-yellow-400', chip: 'bg-yellow-500/10 text-yellow-400', label: 'Edición' },
		abono:      { halo: 'bg-green-500/20',  punto: 'bg-green-400',  chip: 'bg-green-500/10 text-green-400',   label: 'Abono' },
		material:   { halo: 'bg-amber-500/20',  punto: 'bg-amber-400',  chip: 'bg-amber-500/10 text-amber-400',   label: 'Material' },
		entrega:    { halo: 'bg-cyan-500/20',   punto: 'bg-cyan-400',   chip: 'bg-cyan-500/10 text-cyan-400',     label: 'Entrega' },
		nota:       { halo: 'bg-[var(--bg-card-2)]', punto: 'bg-[var(--text-dim)]', chip: '', label: 'Nota' }
	}
</script>

<svelte:head>
	<title>Pedido — Nexus LED</title>
</svelte:head>

<div>
	<!-- ═══ CABECERA ═══ -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex items-center gap-3">
			<a href="/pedidos" class="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-xl font-semibold text-[var(--text)]">Pedido</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {estadoColor[ped.estado] ?? ''}">
						{ped.estado}
					</span>
					<span class="rounded border px-2 py-0.5 text-[11px] font-medium {sem.clase}">
						{sem.label}
					</span>
					{#if Number(ped.prioridad ?? 0) > 0}
						<span class="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase {Number(ped.prioridad) === 2 ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-orange-500/35 bg-orange-500/15 text-orange-400'}">
							{Number(ped.prioridad) === 2 ? 'Urgente' : 'Prioridad alta'}
						</span>
					{/if}
					{#if desfase}
						<span
							class="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
							title="El estado guardado no coincide con el avance real de los items"
						>⚠ debería estar en "{desfase}"</span>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-[var(--text-dim)]">
					{fmtFecha(ped.created_at)}{#if creador} · {creador.nombre}{/if}
				</p>
			</div>
		</div>

		{#if esAdmin || esDiseñador}
			<form method="POST" action="?/cambiarEstadoPedido" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Estado actualizado')
						invalidateAll()
					} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
						mostrarToast(result.data.error, 'error')
					}
				}
			}}>
				<input type="hidden" name="pedido_id" value={ped.id} />
				<input type="hidden" name="estado_anterior" value={ped.estado} />
				<select
					name="estado"
					onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
					class="input-field rounded-lg py-1.5 text-sm"
				>
					{#each ESTADOS_PEDIDO as est}
						<option value={est} selected={est === ped.estado}>{est}</option>
					{/each}
				</select>
			</form>
		{/if}
	</div>

	<!-- ═══ INFO RÁPIDA: Fechas + progreso ═══ -->
	<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Fecha pedido -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
			<p class="text-[10px] text-[var(--text-dim)]">Fecha de pedido</p>
			<p class="mt-0.5 text-sm font-medium text-[var(--text)]">{fmtFecha(ped.created_at)}</p>
		</div>
		<!-- Fecha entrega + instalación -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
			<div class="flex items-center justify-between gap-2">
				<p class="text-[10px] text-[var(--text-dim)]">Fecha de entrega</p>
				<span class="h-1.5 w-1.5 shrink-0 rounded-full {sem.punto}"></span>
			</div>
			<p class="mt-0.5 text-sm font-medium {ped.fecha_entrega ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}">
				{ped.fecha_entrega ? fmtFecha(ped.fecha_entrega) : 'Sin definir'}
			</p>
			<p class="mt-0.5 text-[10px] {sem.nivel === 'vencido' || sem.nivel === 'hoy' ? 'text-red-400' : sem.nivel === 'urgente' ? 'text-amber-400' : 'text-[var(--text-dim)]'}">
				{sem.label}
			</p>

			{#if ped.requiere_instalacion}
				<div class="mt-2 border-t border-[var(--border)] pt-2">
					<p class="flex items-center gap-1 text-[10px] text-cyan-400">
						<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
						Requiere instalación
					</p>
					<p class="mt-0.5 text-xs {ped.fecha_instalacion ? 'text-[var(--text)]' : 'text-amber-400'}">
						{ped.fecha_instalacion ? fmtFecha(ped.fecha_instalacion) : 'Sin agendar'}
						{#if semInstalacion && ped.fecha_instalacion}
							<span class="text-[10px] text-[var(--text-dim)]">· {semInstalacion.label}</span>
						{/if}
					</p>
				</div>
			{/if}

			{#if ped.direccion_entrega}
				<p class="mt-1.5 truncate text-[10px] text-[var(--text-dim)]" title={ped.direccion_entrega}>
					📍 {ped.direccion_entrega}
				</p>
			{/if}
		</div>
		<!-- Progreso -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
			<div class="flex items-center justify-between">
				<p class="text-[10px] text-[var(--text-dim)]">Producción</p>
				<p class="text-[10px] font-medium {pctProgreso === 100 ? 'text-green-400' : 'text-[var(--text-muted)]'}">{pctProgreso}%</p>
			</div>
			<div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card-2)]">
				<div
					class="h-full rounded-full transition-all duration-500 {pctProgreso === 100 ? 'bg-green-500' : 'bg-[var(--brand)]'}"
					style="width: {pctProgreso}%"
				></div>
			</div>
			<div class="mt-1 flex gap-3 text-[10px] text-[var(--text-dim)]">
				{#if pendientes > 0}<span class="text-yellow-400">{pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>{/if}
				{#if enFabricacion > 0}<span class="text-blue-400">{enFabricacion} en fab.</span>{/if}
				{#if terminados > 0}<span class="text-green-400">{terminados} terminado{terminados > 1 ? 's' : ''}</span>{/if}
			</div>
		</div>
		<!-- Diseños -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
			<div class="flex items-center justify-between">
				<p class="text-[10px] text-[var(--text-dim)]">Diseños</p>
				<p class="text-[10px] font-medium {pctDisenos === 100 ? 'text-purple-400' : 'text-[var(--text-muted)]'}">{pctDisenos}%</p>
			</div>
			<div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card-2)]">
				<div
					class="h-full rounded-full transition-all duration-500 {pctDisenos === 100 ? 'bg-purple-500' : 'bg-purple-400/60'}"
					style="width: {pctDisenos}%"
				></div>
			</div>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">
				{disenosHechos}/{items.length} completado{disenosHechos === 1 ? '' : 's'}
			</p>
		</div>
	</div>

	<!-- ═══ CONTENIDO POR ROL ═══ -->
	<div class="mt-6 grid gap-6 lg:grid-cols-3">

		<!-- ══ COLUMNA PRINCIPAL ══ -->
		<div class="lg:col-span-2 space-y-4">

			<!-- ── PRODUCTOS (no visible para finanzas) ── -->
			{#if !esFinanzas}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3">
						<h2 class="text-sm font-medium text-[var(--text)]">Productos ({items.length})</h2>
					</div>

					{#if items.length === 0}
						<div class="py-10 text-center text-sm text-[var(--text-dim)]">Sin productos</div>
					{:else}
						<div class="divide-y divide-[var(--border)]">
							{#each items as item, idx (item.id)}
								{@const asignado = (item as any).perfiles}
								{@const esItemMio = esDiseñador && item.asignado_a === data.userId}
								<div class="px-5 py-4">
									<div class="flex flex-wrap items-start gap-3">
										<div class="min-w-0 flex-1">
											<!-- Badges -->
											<div class="flex flex-wrap items-center gap-2">
												<span class="text-xs text-[var(--text-dim)]">#{idx + 1}</span>
												<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
													{item.tipo_label}
												</span>
												<span class="rounded-full border px-2 py-0.5 text-[10px] font-medium {itemEstadoColor[item.estado_produccion] ?? ''}">
													{ESTADO_ITEM_LABEL[item.estado_produccion as EstadoItem] ?? item.estado_produccion}
												</span>
												{#if item.diseno_completado}
													<span class="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">
														<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
														Diseñado
													</span>
												{/if}
												{#if asignado}
													<span class="text-[10px] text-[var(--text-dim)]">
														<svg class="inline -mt-px mr-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>{asignado.nombre}
													</span>
												{/if}
											</div>

											<!-- Descripción -->
											<p class="mt-1 text-sm text-[var(--text)]">{item.descripcion}</p>

											{#if item.notas_produccion}
												<p class="mt-0.5 text-[10px] text-[var(--text-dim)] italic">{item.notas_produccion}</p>
											{/if}

											<!-- Precios (admin/finanzas) -->
											{#if puedeVerPrecios}
												<div class="mt-1 flex gap-4 text-[10px]">
													<span class="text-[var(--warning)]">Fab: {fmt(item.precio_fabricacion)}</span>
													<span class="text-[var(--text-muted)]">Cliente: {fmt(item.precio_cliente)}</span>
												</div>
											{/if}

											<!-- Archivo de diseño -->
											{#if item.archivo_diseno_url}
												<a
													href={item.archivo_diseno_url}
													target="_blank"
													rel="noopener"
													class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-2.5 py-1 text-[10px] text-[var(--brand-light)] hover:bg-[var(--brand)]/10 transition-colors"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
													Ver archivo de diseño
												</a>
											{/if}
										</div>

										<!-- ACCIONES -->
										<div class="flex shrink-0 flex-col items-end gap-2">
											<!-- Fabricador / Admin: cambiar estado producción -->
											{#if puedeEditarEstadoItems}
												<form method="POST" action="?/cambiarEstadoItem" use:enhance={() => {
													return async ({ result }) => {
														if (result.type === 'success') {
															mostrarToast('Estado actualizado')
															invalidateAll()
														}
													}
												}}>
													<input type="hidden" name="item_id" value={item.id} />
													<input type="hidden" name="pedido_id" value={ped.id} />
													<input type="hidden" name="descripcion" value={item.descripcion} />
													<input type="hidden" name="estado_anterior" value={item.estado_produccion} />
													<select
														name="estado"
														onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
														class="input-field rounded-lg py-1 text-xs"
													>
														<option value="pendiente" selected={item.estado_produccion === 'pendiente'}>Pendiente</option>
														<option value="en_fabricacion" selected={item.estado_produccion === 'en_fabricacion'}>En fabricación</option>
														<option value="terminado" selected={item.estado_produccion === 'terminado'}>Terminado</option>
													</select>
												</form>
											{/if}

											<!-- Diseñador / Admin: subir diseño -->
											{#if esDiseñador || esAdmin}
												<button
													onclick={() => { subiendoDiseno = item.id; urlDiseno = item.archivo_diseno_url ?? ''; descripcionDiseno = item.descripcion }}
													class="btn-secondary rounded-lg px-3 py-1 text-[10px] flex items-center gap-1"
													title="Subir diseño"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
													Diseño
												</button>
											{/if}

											<!-- Marcar diseño completado (diseñador o admin) -->
											{#if esDiseñador || esAdmin}
												<form method="POST" action="?/marcarDiseno" use:enhance={() => {
													return async ({ result }) => {
														if (result.type === 'success') {
															mostrarToast(item.diseno_completado ? 'Diseño marcado como pendiente' : 'Diseño marcado como completado')
															invalidateAll()
														}
													}
												}}>
													<input type="hidden" name="item_id" value={item.id} />
													<input type="hidden" name="pedido_id" value={ped.id} />
													<input type="hidden" name="descripcion" value={item.descripcion} />
													<input type="hidden" name="completado" value={String(!item.diseno_completado)} />
													<button
														type="submit"
														class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] transition-colors {item.diseno_completado ? 'border-purple-500/40 bg-purple-500/10 text-purple-400' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]'}"
														title={item.diseno_completado ? 'Desmarcar diseño' : 'Marcar diseño completado'}
													>
														<span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded border {item.diseno_completado ? 'border-purple-500 bg-purple-500 text-white' : 'border-[var(--border-light)]'}">
															{#if item.diseno_completado}
																<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
															{/if}
														</span>
														Diseño {item.diseno_completado ? 'hecho' : 'pendiente'}
													</button>
												</form>
											{/if}

											<!-- Admin: asignar -->
											{#if esAdmin}
												<form method="POST" action="?/asignarItem" use:enhance={() => {
													return async ({ result }) => {
														if (result.type === 'success') {
															mostrarToast('Asignación actualizada')
															invalidateAll()
														}
													}
												}}>
													<input type="hidden" name="item_id" value={item.id} />
													<input type="hidden" name="pedido_id" value={ped.id} />
													<input type="hidden" name="descripcion" value={item.descripcion} />
													<select
														name="user_id"
														onchange={(e) => {
															const sel = e.currentTarget as HTMLSelectElement
															// Set hidden field with selected name
															const hidden = sel.form?.querySelector('input[name="nombre_asignado"]') as HTMLInputElement
															if (hidden) hidden.value = sel.options[sel.selectedIndex].text
															sel.form?.requestSubmit()
														}}
														class="input-field rounded-lg py-1 text-[10px]"
														title="Asignar a"
													>
														<option value="" selected={!item.asignado_a}>Sin asignar</option>
														{#each data.perfiles as perfil}
															<option value={perfil.id} selected={item.asignado_a === perfil.id}>
																{perfil.nombre} ({perfil.rol})
															</option>
														{/each}
													</select>
													<input type="hidden" name="nombre_asignado" value="" />
												</form>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Finanzas: resumen de productos compacto -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3">
						<h2 class="text-sm font-medium text-[var(--text)]">Productos ({items.length})</h2>
					</div>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
								<th class="px-5 py-2.5 font-medium">#</th>
								<th class="px-5 py-2.5 font-medium">Producto</th>
								<th class="px-5 py-2.5 font-medium text-right">Costo fab.</th>
								<th class="px-5 py-2.5 font-medium text-right">Precio cliente</th>
							</tr>
						</thead>
						<tbody>
							{#each items as item, idx (item.id)}
								<tr class="border-b border-[var(--border)] last:border-b-0">
									<td class="px-5 py-2.5 text-[var(--text-dim)]">{idx + 1}</td>
									<td class="px-5 py-2.5">
										<span class="text-[var(--text)]">{item.descripcion}</span>
										<span class="ml-2 text-[10px] text-[var(--text-dim)]">{item.tipo_label}</span>
									</td>
									<td class="px-5 py-2.5 text-right text-[var(--warning)]">{fmt(item.precio_fabricacion)}</td>
									<td class="px-5 py-2.5 text-right text-[var(--text)]">{fmt(item.precio_cliente)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t border-[var(--border)] font-medium">
								<td colspan="2" class="px-5 py-2.5 text-right text-[var(--text-muted)]">Totales</td>
								<td class="px-5 py-2.5 text-right text-[var(--warning)]">{fmt(costoFab)}</td>
								<td class="px-5 py-2.5 text-right text-[var(--text)]">{fmt(totalCliente)}</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}

			<!-- ── MATERIAL / PROVEEDORES ── -->
		{#if esAdmin || esFinanzas || esFabricador}
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
					<div>
						<h2 class="text-sm font-medium text-[var(--text)]">Material y proveedores</h2>
						<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
							{#if compras.length === 0}
								Sin material registrado — no se puede saber qué frena el pedido
							{:else}
								{mat.recibidos}/{mat.total} recibido{mat.total === 1 ? '' : 's'}
								{#if puedeVerPrecios}
									· costo real {fmt(costoMaterialReal)}
									{#if costoFab > 0}
										<span class={costoMaterialReal > costoFab ? 'text-red-400' : 'text-green-400'}>
											(estimado {fmt(costoFab)})
										</span>
									{/if}
								{/if}
							{/if}
						</p>
					</div>
					{#if (esAdmin || esFinanzas) && !agregandoMaterial}
						<button
							onclick={() => { agregandoMaterial = true; limpiarMaterial() }}
							class="btn-secondary flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px]"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
							Agregar material
						</button>
					{/if}
				</div>

				<!-- Alerta: el material llega después de la fecha prometida -->
				{#if mat.riesgo}
					<div class="flex items-start gap-2 border-b border-red-500/25 bg-red-500/5 px-5 py-3">
						<svg class="mt-0.5 shrink-0 text-red-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
						<p class="text-xs text-red-300">
							Hay material que llega <strong>después</strong> de la fecha de entrega ({fmtFecha(ped.fecha_entrega)}).
							Mueve la fecha con el cliente o busca otro proveedor.
						</p>
					</div>
				{/if}

				<!-- Formulario: registrar material -->
				{#if agregandoMaterial}
					<form method="POST" action="?/crearCompra" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								mostrarToast('Material registrado')
								agregandoMaterial = false
								limpiarMaterial()
								invalidateAll()
							} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
								mostrarToast(result.data.error, 'error')
							}
						}
					}} class="border-b border-[var(--border)] bg-[var(--bg-card-2)] px-5 py-4 space-y-3">
						<input type="hidden" name="pedido_id" value={ped.id} />

						<div class="grid gap-3 sm:grid-cols-2">
							<div class="sm:col-span-2">
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Material *</label>
								<input
									type="text"
									name="material"
									bind:value={matMaterial}
									required
									placeholder="Ej: Acrílico 3mm transparente"
									class="input-field w-full"
								/>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Cantidad</label>
								<input
									type="text"
									name="cantidad"
									bind:value={matCantidad}
									placeholder="2 láminas, 6 m..."
									class="input-field w-full"
								/>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Proveedor</label>
								<select name="proveedor_id" bind:value={matProveedor} class="input-field w-full">
									<option value="">Sin definir</option>
									{#each proveedores as p}
										<option value={p.id}>{p.nombre}</option>
									{/each}
								</select>
								<button
									type="button"
									onclick={() => (creandoProveedor = true)}
									class="mt-1 text-[10px] text-[var(--brand-light)] hover:underline"
								>+ Nuevo proveedor</button>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Para el producto</label>
								<select name="pedido_item_id" bind:value={matItem} class="input-field w-full">
									<option value="">Todo el pedido</option>
									{#each items as it}
										<option value={it.id}>{it.tipo_label} — {it.descripcion.slice(0, 32)}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Estado</label>
								<select name="estado" bind:value={matEstado} class="input-field w-full">
									{#each ESTADOS_COMPRA as e}
										<option value={e}>{ESTADO_COMPRA_LABEL[e]}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Costo real</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
									<input type="number" name="costo_real" bind:value={matCosto} min="0" class="input-field w-full !pl-8" />
								</div>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Llega el</label>
								<input type="date" name="fecha_estimada" bind:value={matFechaEstimada} class="input-field w-full" />
								{#if matFechaEstimada && ped.fecha_entrega && matFechaEstimada > ped.fecha_entrega}
									<p class="mt-1 text-[10px] text-red-400">Llega después de la entrega</p>
								{/if}
							</div>
						</div>

						<div class="flex gap-2">
							<button
								type="submit"
								disabled={!matMaterial.trim()}
								class="btn-primary rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-40"
							>Registrar</button>
							<button
								type="button"
								onclick={() => { agregandoMaterial = false; limpiarMaterial() }}
								class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
							>Cancelar</button>
						</div>
					</form>
				{/if}

				<!-- Lista de material -->
				{#if compras.length === 0}
					<div class="px-5 py-8 text-center">
						<p class="text-sm text-[var(--text-dim)]">Sin material registrado</p>
						{#if esAdmin || esFinanzas}
							<p class="mx-auto mt-1 max-w-sm text-[11px] text-[var(--text-dim)]">
								Registra lo que hay que comprar y a quién. Así se ve de una cuál pedido está
								esperando proveedor y cuánto costó de verdad.
							</p>
						{/if}
					</div>
				{:else}
					<ul class="divide-y divide-[var(--border)]">
						{#each compras as c (c.id)}
							{@const prov = (c as any).proveedores}
							{@const tarde = c.estado !== 'recibido' && c.fecha_estimada && ped.fecha_entrega && c.fecha_estimada > ped.fecha_entrega}
							{@const diasLlegada = c.estado !== 'recibido' ? diasHasta(c.fecha_estimada) : null}
							<li class="px-5 py-3">
								<div class="flex flex-wrap items-start gap-3">
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
										</div>

										<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-dim)]">
											{#if prov}
												<span>{prov.nombre}</span>
												{#if prov.contacto}
													<a
														href={`https://wa.me/${prov.contacto.replace(/\D/g, '')}`}
														target="_blank"
														rel="noopener noreferrer"
														class="text-green-400 hover:underline"
													>escribir</a>
												{/if}
											{:else}
												<span class="text-amber-400/80">sin proveedor</span>
											{/if}
											{#if c.fecha_pedido}
												<span>pedido {fmtFecha(c.fecha_pedido)}</span>
											{/if}
											{#if c.fecha_estimada && c.estado !== 'recibido'}
												<span class={tarde ? 'text-red-400' : ''}>
													llega {fmtFecha(c.fecha_estimada)}{#if diasLlegada !== null}
														· {diasLlegada < 0 ? `atrasado ${Math.abs(diasLlegada)}d` : diasLlegada === 0 ? 'hoy' : `en ${diasLlegada}d`}
													{/if}
												</span>
											{/if}
											{#if c.fecha_recibido}
												<span class="text-green-400">recibido {fmtFecha(c.fecha_recibido)}</span>
											{/if}
											{#if puedeVerPrecios && Number(c.costo_real) > 0}
												<span class="text-[var(--warning)]">{fmt(c.costo_real)}</span>
											{/if}
										</div>
									</div>

									<!-- Cambiar estado: el fabricador marca recibido cuando llega -->
									<div class="flex shrink-0 items-center gap-2">
										<form method="POST" action="?/actualizarCompra" use:enhance={() => {
											return async ({ result }) => {
												if (result.type === 'success') {
													mostrarToast('Material actualizado')
													invalidateAll()
												} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
													mostrarToast(result.data.error, 'error')
												}
											}
										}}>
											<input type="hidden" name="pedido_id" value={ped.id} />
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

										{#if esAdmin || esFinanzas}
											<form method="POST" action="?/eliminarCompra" use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														mostrarToast('Material eliminado')
														invalidateAll()
													}
												}
											}}>
												<input type="hidden" name="pedido_id" value={ped.id} />
												<input type="hidden" name="compra_id" value={c.id} />
												<button
													type="submit"
													onclick={(e) => { if (!confirm(`¿Eliminar "${c.material}"?`)) e.preventDefault() }}
													class="text-[var(--text-dim)] hover:text-red-400 transition-colors"
													title="Eliminar material"
													aria-label="Eliminar material"
												>
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
												</button>
											</form>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<!-- ── TIMELINE ── -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-5 py-3">
					<h2 class="text-sm font-medium text-[var(--text)]">Actividad</h2>
				</div>

				<!-- Agregar nota -->
				<form method="POST" action="?/agregarNota" use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							mostrarToast('Nota agregada')
							nuevaNota = ''
							invalidateAll()
						}
					}
				}}>
					<div class="flex gap-2 border-b border-[var(--border)] px-5 py-3">
						<input type="hidden" name="pedido_id" value={ped.id} />
						<input
							type="text"
							name="contenido"
							bind:value={nuevaNota}
							placeholder="Agregar una nota..."
							class="input-field flex-1"
						/>
						<button
							type="submit"
							disabled={!nuevaNota.trim()}
							class="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-40"
						>Enviar</button>
					</div>
				</form>

				{#if notas.length === 0}
					<div class="px-5 py-8 text-center text-sm text-[var(--text-dim)]">Sin actividad registrada</div>
				{:else}
					<div class="px-5 py-3">
						<div class="relative pl-6">
							<!-- Línea vertical -->
							<div class="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]"></div>

							{#each notas as nota, idx (nota.id)}
								{@const autor = (nota as any).perfiles}
								{@const tipo = tipoNota(nota.contenido)}
								{@const est = notaEstilo[tipo]}
								{@const esUltimo = idx === notas.length - 1}
								<div class="relative pb-4 {esUltimo ? 'pb-0' : ''}">
									<!-- Punto del timeline -->
									<div class="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full {est.halo}">
										<div class="h-1.5 w-1.5 rounded-full {est.punto}"></div>
									</div>

									<!-- Contenido -->
									<div>
										<div class="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
											<span class="font-medium text-[var(--text-muted)]">{autor?.nombre ?? 'Sistema'}</span>
											<span>·</span>
											<span>{fmtRelativa(nota.created_at)}</span>
											{#if tipo !== 'nota'}
												<span class="rounded px-1 py-0.5 text-[9px] {est.chip}">
													{est.label}
												</span>
											{/if}
										</div>
										<p class="mt-0.5 text-sm text-[var(--text)]">{limpiarPrefijo(nota.contenido)}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ══ COLUMNA LATERAL ══ -->
		<div class="space-y-4">
			<!-- Resumen financiero (admin/finanzas) -->
			{#if puedeVerPrecios}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Resumen financiero</h2>
					<dl class="space-y-2.5 text-sm">
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Costo fabricación</dt>
							<dd class="font-medium text-[var(--warning)]">{fmt(costoFab)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Total cliente</dt>
							<dd class="text-[var(--text)]">{fmt(ped.precio_total)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-[var(--text-muted)]">Abono</dt>
							<dd class="text-green-400">{fmt(ped.abono)}</dd>
						</div>
					</dl>

					<div class="mt-3 flex items-center justify-between rounded-lg px-4 py-3
						{Number(ped.saldo) > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}
					">
						<span class="text-sm font-medium {Number(ped.saldo) > 0 ? 'text-red-400' : 'text-green-400'}">
							{Number(ped.saldo) > 0 ? 'Saldo pendiente' : 'Pagado'}
						</span>
						<span class="text-lg font-bold {Number(ped.saldo) > 0 ? 'text-red-400' : 'text-green-400'}">
							{fmt(ped.saldo)}
						</span>
					</div>

					{#if Number(ped.saldo) > 0 && puedeVerPrecios}
						<button onclick={() => { anadiendoAbono = true; nuevoMontoAbono = 0 }} class="mt-3 w-full btn-secondary rounded-lg py-1.5 text-xs font-medium">
							Añadir abono
						</button>
					{/if}

					{#if totalCliente > 0}
						<p class="mt-3 text-center text-[10px] text-[var(--text-dim)]">
							Ganancia: {fmt(ganancia)} ({margenPct}%)
						</p>
					{/if}
				</div>
			{/if}

			<!-- Abonos (admin / finanzas) -->
			{#if puedeGestionarAbonos}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
					<div class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
						<div>
							<h2 class="text-sm font-medium text-[var(--text)]">Abonos</h2>
							<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
								{abonos.length} registrado{abonos.length === 1 ? '' : 's'} · Saldo: <span class={saldoPendiente > 0 ? 'text-red-400' : 'text-green-400'}>{fmt(saldoPendiente)}</span>
							</p>
						</div>
						{#if !agregandoAbono && saldoPendiente > 0}
							<button
								onclick={() => { agregandoAbono = true; abonoMonto = 0; abonoConcepto = '' }}
								class="btn-secondary flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px]"
								title="Registrar abono"
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
								Agregar
							</button>
						{/if}
					</div>

					{#if agregandoAbono}
						<form method="POST" action="?/agregarAbono" use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') {
									mostrarToast('Abono registrado')
									agregandoAbono = false
									abonoMonto = 0
									abonoConcepto = ''
									abonoBanco = ''
									invalidateAll()
								} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
									mostrarToast(result.data.error, 'error')
								}
							}
						}} class="border-b border-[var(--border)] bg-[var(--bg-card-2)] px-5 py-4 space-y-3">
							<input type="hidden" name="pedido_id" value={ped.id} />
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Monto ($) *</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
									<input
										type="number"
										name="monto"
										bind:value={abonoMonto}
										min="1"
										max={saldoPendiente}
										required
										placeholder="0"
										class="input-field w-full !pl-8"
									/>
								</div>
								<p class="mt-1 text-[10px] text-[var(--text-dim)]">
									Máximo disponible: {fmt(saldoPendiente)}
								</p>
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Banco / Cartera</label>
								{#if bancos.length === 0}
									<p class="text-[10px] text-[var(--text-dim)]">
										<a href="/bancos" class="text-[var(--brand-light)] hover:underline">Crea un banco</a> para registrar dónde llegó el pago
									</p>
								{:else}
									<select name="banco_id" bind:value={abonoBanco} class="input-field w-full">
										<option value="">Sin especificar</option>
										{#each bancos as b}
											<option value={b.id}>{b.nombre}</option>
										{/each}
									</select>
								{/if}
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Concepto (opcional)</label>
								<input
									type="text"
									name="concepto"
									bind:value={abonoConcepto}
									placeholder="Ej: Transferencia, efectivo, comprobante..."
									class="input-field w-full"
								/>
							</div>
							<div class="flex gap-2">
								<button
									type="submit"
									disabled={abonoMonto <= 0 || abonoMonto > saldoPendiente}
									class="btn-primary flex-1 rounded-lg py-1.5 text-sm font-medium disabled:opacity-40"
								>Registrar</button>
								<button
									type="button"
									onclick={() => { agregandoAbono = false }}
									class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
								>Cancelar</button>
							</div>
						</form>
					{/if}

					{#if abonos.length === 0}
						<div class="px-5 py-6 text-center text-xs text-[var(--text-dim)]">
							{saldoPendiente > 0 ? 'Sin abonos registrados' : 'Pedido pagado'}
						</div>
					{:else}
						<ul class="divide-y divide-[var(--border)]">
							{#each abonos as ab (ab.id)}
								{@const autor = (ab as any).perfiles}
								{@const banco = (ab as any).bancos}
								<li class="px-5 py-3">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-green-400">+{fmt(ab.monto)}</p>
											<p class="mt-0.5 text-xs text-[var(--text-muted)]">{ab.concepto}</p>
											<div class="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-dim)]">
												<span>{fmtFecha(ab.fecha)}</span>
												{#if autor}<span>· {autor.nombre}</span>{/if}
												{#if banco}
													<span
														class="rounded px-1.5 py-0.5 font-medium"
														style="background-color: {banco.color}20; color: {banco.color}"
													>
														{banco.nombre}
													</span>
												{/if}
											</div>
										</div>
										<form method="POST" action="?/eliminarAbono" use:enhance={() => {
											return async ({ result }) => {
												if (result.type === 'success') {
													mostrarToast('Abono eliminado')
													invalidateAll()
												} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
													mostrarToast(result.data.error, 'error')
												}
											}
										}}>
											<input type="hidden" name="pedido_id" value={ped.id} />
											<input type="hidden" name="movimiento_id" value={ab.id} />
											<button
												type="submit"
												onclick={(e) => {
													if (!confirm(`¿Eliminar abono de ${fmt(ab.monto)}?`)) e.preventDefault()
												}}
												class="text-[var(--text-dim)] hover:text-red-400 transition-colors"
												title="Eliminar abono"
												aria-label="Eliminar abono"
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
											</button>
										</form>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<!-- Entrega: cierre del pedido con evidencia -->
			{#if esAdmin || esFabricador}
				<div class="rounded-xl border bg-[var(--bg-card)] p-5 {entregado ? 'border-emerald-500/30' : listoParaEntregar ? 'border-[var(--brand)]/40' : 'border-[var(--border)]'}">
					<h2 class="text-sm font-medium text-[var(--text)]">
						{ped.requiere_instalacion ? 'Entrega e instalación' : 'Entrega'}
					</h2>

					{#if entregado}
						<div class="mt-3 space-y-2">
							<p class="flex items-center gap-2 text-sm text-emerald-400">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Entregado
							</p>
							{#if ped.fecha_entregado}
								<p class="text-[11px] text-[var(--text-dim)]">
									{fmtFecha(ped.fecha_entregado)}
									{#if ped.fecha_entrega}
										<span class={ped.fecha_entregado.slice(0, 10) > ped.fecha_entrega ? 'text-amber-400' : 'text-green-400'}>
											· {ped.fecha_entregado.slice(0, 10) > ped.fecha_entrega ? 'fuera de fecha' : 'a tiempo'}
										</span>
									{/if}
								</p>
							{/if}
							{#if ped.foto_entrega_url}
								<img
									src={ped.foto_entrega_url}
									alt="Evidencia de entrega"
									class="mt-1 max-h-40 w-full rounded-lg border border-[var(--border)] bg-[#080808] object-contain"
								/>
							{/if}

							{#if esAdmin}
								<form method="POST" action="?/marcarEntregado" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											mostrarToast('Entrega deshecha')
											invalidateAll()
										}
									}
								}}>
									<input type="hidden" name="pedido_id" value={ped.id} />
									<input type="hidden" name="deshacer" value="true" />
									<button
										type="submit"
										onclick={(e) => { if (!confirm('¿Deshacer la entrega? El pedido vuelve a Terminado.')) e.preventDefault() }}
										class="mt-1 text-[11px] text-[var(--text-dim)] transition-colors hover:text-red-400"
									>Deshacer entrega</button>
								</form>
							{/if}
						</div>
					{:else}
						<p class="mt-1 text-[11px] text-[var(--text-dim)]">
							{#if items.length === 0}
								Agrega productos al pedido primero
							{:else if !listoParaEntregar}
								Faltan {items.length - terminados} item{items.length - terminados === 1 ? '' : 's'} por terminar
							{:else if Number(ped.saldo) > 0}
								Listo para entregar · saldo pendiente {fmt(ped.saldo)}
							{:else}
								Listo para entregar y pagado
							{/if}
						</p>

						{#if !confirmandoEntrega}
							<button
								onclick={() => { confirmandoEntrega = true; fotoEntrega = '' }}
								disabled={items.length === 0}
								class="mt-3 w-full rounded-lg py-2 text-sm font-medium disabled:opacity-40 {listoParaEntregar ? 'btn-primary' : 'btn-secondary'}"
							>Marcar como entregado</button>
						{:else}
							<div class="mt-3 space-y-3">
								{#if fotoEntrega}
									<div class="relative overflow-hidden rounded-lg border border-[var(--border)]">
										<img src={fotoEntrega} alt="Evidencia" class="max-h-40 w-full bg-[#080808] object-contain" />
										<button
											type="button"
											onclick={() => (fotoEntrega = '')}
											class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white/80 transition-colors hover:text-red-400"
											title="Quitar foto"
											aria-label="Quitar foto"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
										</button>
									</div>
								{:else}
									<label class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-white/12 bg-white/2 p-4 transition-all hover:border-white/25">
										<input
											type="file"
											accept="image/*"
											capture="environment"
											class="hidden"
											onchange={async (e) => {
												const input = e.target as HTMLInputElement
												const file = input.files?.[0]
												if (!file) return
												const { url, error } = await subirImagenComprimida(file, 'disenos')
												if (error) {
													mostrarToast('Error al subir imagen: ' + error, 'error')
													return
												}
												fotoEntrega = url
												mostrarToast('Foto subida')
											}}
										/>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-dim)]"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
										<span class="text-xs font-medium text-[var(--text-muted)]">Foto de la entrega</span>
										<span class="text-[10px] text-[var(--text-dim)]">Opcional, sirve de respaldo</span>
									</label>
								{/if}

								<form method="POST" action="?/marcarEntregado" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											mostrarToast('Pedido entregado')
											confirmandoEntrega = false
											fotoEntrega = ''
											invalidateAll()
										} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
											mostrarToast(result.data.error, 'error')
										}
									}
								}} class="flex gap-2">
									<input type="hidden" name="pedido_id" value={ped.id} />
									<input type="hidden" name="foto_entrega_url" value={fotoEntrega} />
									<button type="submit" class="btn-primary flex-1 rounded-lg py-1.5 text-sm font-medium">
										Confirmar entrega
									</button>
									<button
										type="button"
										onclick={() => { confirmandoEntrega = false; fotoEntrega = '' }}
										class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
									>Cancelar</button>
								</form>
							</div>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Cliente -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
				<h2 class="mb-3 text-sm font-medium text-[var(--text)]">Cliente</h2>
				{#if cliente}
					<div class="space-y-1.5 text-sm">
						<p class="font-medium text-[var(--text)]">{cliente.nombre}</p>
						{#if cliente.empresa}
							<p class="text-[var(--text-muted)]">{cliente.empresa}</p>
						{/if}
						{#if cliente.contacto}
							<div class="flex items-center gap-1.5 text-[var(--text-dim)]">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
								{cliente.contacto}
							</div>
						{/if}
						{#if cliente.email}
							<div class="flex items-center gap-1.5 text-[var(--text-dim)]">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
								{cliente.email}
							</div>
						{/if}
						{#if cliente.ciudad}
							<div class="flex items-center gap-1.5 text-[var(--text-dim)]">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
								{cliente.ciudad}
							</div>
						{/if}

						{#if cliente.contacto}
							<a
								href={`https://wa.me/${cliente.contacto.replace(/\D/g, '')}`}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600/15 border border-green-500/25 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-600/25 hover:border-green-500/40 transition-all"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
								Contactar por WhatsApp
							</a>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-[var(--text-dim)]">Sin cliente asignado</p>
				{/if}
			</div>

			<!-- Admin: editar info del pedido -->
			{#if esAdmin}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-medium text-[var(--text)]">Información</h2>
						<button
							onclick={() => { editandoInfo = !editandoInfo }}
							class="text-xs text-[var(--brand-light)] hover:underline"
						>{editandoInfo ? 'Cancelar' : 'Editar'}</button>
					</div>

					{#if editandoInfo}
						<form method="POST" action="?/actualizarPedido" use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') {
									mostrarToast('Pedido actualizado')
									editandoInfo = false
									invalidateAll()
								}
							}
						}} class="mt-3 space-y-3">
							<input type="hidden" name="pedido_id" value={ped.id} />
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Fecha de entrega</label>
								<input type="date" name="fecha_entrega" bind:value={editFechaEntrega} class="input-field w-full" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Dirección de entrega</label>
								<input
									type="text"
									name="direccion_entrega"
									bind:value={editDireccion}
									placeholder="Dónde se entrega o instala..."
									class="input-field w-full"
								/>
							</div>

							<!-- Instalación: solo si el cliente la pidió -->
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									name="requiere_instalacion"
									value="true"
									bind:checked={editRequiereInstalacion}
									class="h-4 w-4 accent-[var(--brand)]"
								/>
								<span class="text-xs text-[var(--text)]">El cliente pide instalación</span>
							</label>
							{#if editRequiereInstalacion}
								<div>
									<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Fecha de instalación</label>
									<input type="date" name="fecha_instalacion" bind:value={editFechaInstalacion} class="input-field w-full" />
								</div>
							{/if}

							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Prioridad</label>
								<select name="prioridad" bind:value={editPrioridad} class="input-field w-full">
									<option value={0}>Normal</option>
									<option value={1}>Alta</option>
									<option value={2}>Urgente</option>
								</select>
							</div>

							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Nota</label>
								<textarea name="nota" bind:value={editNota} rows="2" class="input-field w-full resize-none"></textarea>
							</div>
							<button type="submit" class="btn-primary w-full rounded-lg py-2 text-sm font-medium">Guardar</button>
						</form>
					{:else}
						<dl class="mt-3 space-y-2 text-sm">
							<div class="flex justify-between">
								<dt class="text-[var(--text-muted)]">Entrega</dt>
								<dd class="text-[var(--text)]">{ped.fecha_entrega ? fmtFecha(ped.fecha_entrega) : '—'}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--text-muted)]">Instalación</dt>
								<dd class="text-[var(--text)]">
									{#if !ped.requiere_instalacion}
										<span class="text-[var(--text-dim)]">No requiere</span>
									{:else if ped.fecha_instalacion}
										{fmtFecha(ped.fecha_instalacion)}
									{:else}
										<span class="text-amber-400">Sin agendar</span>
									{/if}
								</dd>
							</div>
							{#if Number(ped.prioridad ?? 0) > 0}
								<div class="flex justify-between">
									<dt class="text-[var(--text-muted)]">Prioridad</dt>
									<dd class={Number(ped.prioridad) === 2 ? 'text-red-400' : 'text-orange-400'}>
										{Number(ped.prioridad) === 2 ? 'Urgente' : 'Alta'}
									</dd>
								</div>
							{/if}
							{#if ped.direccion_entrega}
								<div>
									<dt class="text-[var(--text-muted)]">Dirección</dt>
									<dd class="mt-0.5 text-[var(--text)]">{ped.direccion_entrega}</dd>
								</div>
							{/if}
							{#if ped.nota}
								<div>
									<dt class="text-[var(--text-muted)]">Nota</dt>
									<dd class="mt-0.5 text-[var(--text)]">{ped.nota}</dd>
								</div>
							{/if}
							{#if ped.cotizacion_id}
								<div class="flex justify-between">
									<dt class="text-[var(--text-muted)]">Cotización</dt>
									<dd><a href="/cotizaciones/{ped.cotizacion_id}" class="text-[var(--brand-light)] hover:underline text-xs">Ver cotización</a></dd>
								</div>
							{/if}
						</dl>
					{/if}
				</div>
			{/if}

			<!-- Imagen de referencia -->
			{#if ped.imagen_url}
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
					<h2 class="mb-2 text-xs font-medium text-[var(--text-muted)]">Imagen de referencia</h2>
					<img src={ped.imagen_url} alt="Referencia" class="max-h-48 w-full rounded-lg object-contain" />
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Modal: Nuevo proveedor -->
{#if creandoProveedor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (creandoProveedor = false)}>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--text)]">Nuevo proveedor</h3>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Queda disponible para todos los pedidos</p>

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
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Nombre *</label>
					<input type="text" name="nombre" bind:value={provNombre} required class="input-field w-full" />
				</div>
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Teléfono / WhatsApp</label>
					<input type="text" name="contacto" bind:value={provContacto} class="input-field w-full" />
				</div>
				<div>
					<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Qué vende</label>
					<input
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

<!-- Modal: Subir diseño -->
{#if subiendoDiseno}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (subiendoDiseno = null)}>
		<div class="mx-4 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold text-[var(--text)]">Subir archivo de diseño</h3>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Sube una imagen o foto del diseño</p>

			{#if urlDiseno}
				<div class="mt-4 relative rounded-xl overflow-hidden border border-[var(--border)]">
					<img src={urlDiseno} alt="Diseño" class="w-full max-h-48 object-contain bg-[#080808]" />
					<button
						type="button"
						onclick={() => { urlDiseno = '' }}
						class="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-lg bg-black/70 backdrop-blur border border-white/15 text-white/80 hover:text-red-400 hover:border-red-400/40 transition-colors"
						title="Eliminar"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			{:else}
				<label class="mt-4 flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-white/12 rounded-xl bg-white/2 cursor-pointer hover:border-white/25 hover:bg-white/4 transition-all">
					<input
						type="file"
						accept="image/*"
						capture="environment"
						class="hidden"
						onchange={async (e) => {
							const input = e.target as HTMLInputElement
							const file = input.files?.[0]
							if (!file) return
							const { url, error } = await subirImagenComprimida(file, 'disenos')
							if (error) {
								mostrarToast('Error al subir imagen: ' + error, 'error')
								return
							}
							urlDiseno = url
							mostrarToast('Imagen subida')
						}}
					/>
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-dim)]"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					<span class="text-sm font-medium text-[var(--text-muted)]">Subir imagen o tomar foto</span>
					<span class="text-[10px] text-[var(--text-dim)]">Toca para seleccionar del dispositivo</span>
				</label>
			{/if}

			<form method="POST" action="?/subirDiseno" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Diseño guardado')
						subiendoDiseno = null
						invalidateAll()
					}
				}
			}}>
				<input type="hidden" name="item_id" value={subiendoDiseno} />
				<input type="hidden" name="pedido_id" value={ped.id} />
				<input type="hidden" name="descripcion" value={descripcionDiseno} />
				<input type="hidden" name="archivo_url" value={urlDiseno} />
				<div class="mt-4 flex justify-end gap-3">
					<button type="button" onclick={() => (subiendoDiseno = null)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button type="submit" disabled={!urlDiseno} class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40">Guardar</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Añadir Abono -->
{#if anadiendoAbono}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (anadiendoAbono = false)}>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold text-[var(--text)]">Añadir abono</h3>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Ingresa el monto adicional a abonar al pedido.</p>

			<form method="POST" action="?/añadirAbono" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Abono registrado correctamente')
						anadiendoAbono = false
						invalidateAll()
					}
				}
			}}>
				<input type="hidden" name="pedido_id" value={ped.id} />
				<div class="mt-4">
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto a abonar</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]">$</span>
						<input type="number" name="monto" bind:value={nuevoMontoAbono} min="1" max={ped.saldo} class="input-field w-full pl-7" required />
					</div>
				</div>
				<div class="mt-5 flex justify-end gap-3">
					<button type="button" onclick={() => (anadiendoAbono = false)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button type="submit" disabled={!nuevoMontoAbono || nuevoMontoAbono <= 0} class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40">Registrar abono</button>
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
