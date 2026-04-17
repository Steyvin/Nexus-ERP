<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha, fmtRelativa } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { subirImagenComprimida } from '$lib/utils/upload'
	import { ESTADOS_PEDIDO, ESTADO_ITEM_LABEL } from '$lib/types'
	import type { EstadoItem } from '$lib/types'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const ped = $derived(data.pedido)
	const cliente = $derived((ped as any).clientes)
	const creador = $derived((ped as any).perfiles)
	const items = $derived((ped as any).pedido_items ?? [])
	const notas = $derived((ped as any).pedido_notas ?? [])

	const esAdmin = $derived(data.rol === 'admin')
	const esFinanzas = $derived(data.rol === 'finanzas')
	const esFabricador = $derived(data.rol === 'fabricador')
	const esDiseñador = $derived(data.rol === 'diseñador')
	const puedeVerPrecios = $derived(esAdmin || esFinanzas)
	const puedeEditarEstadoItems = $derived(esAdmin || esFabricador)

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
	let editAbono = $state(0)
	let editNota = $state('')

	// Sincroniza los campos del formulario con el pedido cuando no se está editando
	$effect(() => {
		if (!editandoInfo) {
			editFechaEntrega = ped.fecha_entrega ?? ''
			editAbono = Number(ped.abono) || 0
			editNota = ped.nota ?? ''
		}
	})

	// Detectar tipo de nota para iconos en el timeline
	function tipoNota(contenido: string): 'estado' | 'diseno' | 'asignacion' | 'edicion' | 'nota' {
		if (contenido.startsWith('[Estado]')) return 'estado'
		if (contenido.startsWith('[Diseño]')) return 'diseno'
		if (contenido.startsWith('[Asignación]')) return 'asignacion'
		if (contenido.startsWith('[Edición]')) return 'edicion'
		return 'nota'
	}

	function limpiarPrefijo(contenido: string): string {
		return contenido.replace(/^\[(Estado|Diseño|Asignación|Edición)\]\s*/, '')
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
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-semibold text-[var(--text)]">Pedido</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {estadoColor[ped.estado] ?? ''}">
						{ped.estado}
					</span>
				</div>
				<p class="mt-0.5 text-xs text-[var(--text-dim)]">
					{fmtFecha(ped.created_at)}{#if creador} · {creador.nombre}{/if}
				</p>
			</div>
		</div>

		{#if esAdmin}
			<form method="POST" action="?/cambiarEstadoPedido" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Estado actualizado')
						invalidateAll()
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
		<!-- Fecha entrega -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
			<p class="text-[10px] text-[var(--text-dim)]">Fecha de entrega</p>
			<p class="mt-0.5 text-sm font-medium {ped.fecha_entrega ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}">
				{ped.fecha_entrega ? fmtFecha(ped.fecha_entrega) : 'Sin definir'}
			</p>
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
								<div class="px-5 py-4 {esDiseñador && !esItemMio ? 'opacity-40' : ''}">
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
											{#if (esDiseñador && esItemMio) || esAdmin}
												<button
													onclick={() => { subiendoDiseno = item.id; urlDiseno = item.archivo_diseno_url ?? ''; descripcionDiseno = item.descripcion }}
													class="btn-secondary rounded-lg px-3 py-1 text-[10px] flex items-center gap-1"
													title="Subir diseño"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
													Diseño
												</button>
											{/if}

											<!-- Marcar diseño completado (diseñador asignado o admin) -->
											{#if (esDiseñador && esItemMio) || esAdmin}
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
								{@const esUltimo = idx === notas.length - 1}
								<div class="relative pb-4 {esUltimo ? 'pb-0' : ''}">
									<!-- Punto del timeline -->
									<div class="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full
										{tipo === 'estado' ? 'bg-blue-500/20' : tipo === 'diseno' ? 'bg-purple-500/20' : tipo === 'asignacion' ? 'bg-orange-500/20' : tipo === 'edicion' ? 'bg-yellow-500/20' : 'bg-[var(--bg-card-2)]'}
									">
										<div class="h-1.5 w-1.5 rounded-full
											{tipo === 'estado' ? 'bg-blue-400' : tipo === 'diseno' ? 'bg-purple-400' : tipo === 'asignacion' ? 'bg-orange-400' : tipo === 'edicion' ? 'bg-yellow-400' : 'bg-[var(--text-dim)]'}
										"></div>
									</div>

									<!-- Contenido -->
									<div>
										<div class="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
											<span class="font-medium text-[var(--text-muted)]">{autor?.nombre ?? 'Sistema'}</span>
											<span>·</span>
											<span>{fmtRelativa(nota.created_at)}</span>
											{#if tipo !== 'nota'}
												<span class="rounded px-1 py-0.5 text-[9px]
													{tipo === 'estado' ? 'bg-blue-500/10 text-blue-400' : tipo === 'diseno' ? 'bg-purple-500/10 text-purple-400' : tipo === 'asignacion' ? 'bg-orange-500/10 text-orange-400' : 'bg-yellow-500/10 text-yellow-400'}
												">
													{tipo === 'estado' ? 'Estado' : tipo === 'diseno' ? 'Diseño' : tipo === 'asignacion' ? 'Asignación' : 'Edición'}
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

					{#if totalCliente > 0}
						<p class="mt-3 text-center text-[10px] text-[var(--text-dim)]">
							Ganancia: {fmt(ganancia)} ({margenPct}%)
						</p>
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
								<label class="mb-1 block text-[10px] text-[var(--text-muted)]">Abono ($)</label>
								<input type="number" name="abono" bind:value={editAbono} min="0" class="input-field w-full" />
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
								<dt class="text-[var(--text-muted)]">Abono</dt>
								<dd class="text-[var(--text)]">{fmt(ped.abono)}</dd>
							</div>
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
