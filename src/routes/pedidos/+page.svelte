<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha, fmtRelativa } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { subirImagenComprimida } from '$lib/utils/upload'
	import { ESTADOS_PEDIDO, ESTADO_ITEM_LABEL } from '$lib/types'
	import type { EstadoItem, EstadoPedido } from '$lib/types'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const esAdmin = $derived(data.rol === 'admin')
	const esFinanzas = $derived(data.rol === 'finanzas')
	const esFabricador = $derived(data.rol === 'fabricador')
	const esDiseñador = $derived(data.rol === 'diseñador')
	const puedeVerPrecios = $derived(esAdmin || esFinanzas)

	// Pedido expandido
	let expandido = $state<string | null>(null)

	// Diseñador: modal de subir diseño
	let subiendoDiseno = $state<string | null>(null)
	let urlDiseno = $state('')

	let busquedaLocal = $state(data.busqueda ?? '')

	// ── Filtros de estado según rol ──
	const filtrosEstado = $derived.by(() => {
		if (esFabricador) {
			return [
				{ val: null, label: 'Todos' },
				{ val: 'En fabricación', label: 'En fabricación' },
				{ val: 'En proceso', label: 'En proceso' },
				{ val: 'Terminado', label: 'Terminados' }
			]
		}
		if (esDiseñador) {
			return [
				{ val: null, label: 'Todos' },
				{ val: 'Pedido realizado', label: 'Nuevos' },
				{ val: 'En proceso', label: 'En proceso' }
			]
		}
		return [
			{ val: null, label: 'Todos' },
			...ESTADOS_PEDIDO.map((e) => ({ val: e, label: e }))
		]
	})

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

	function aplicarParams(overrides: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams)
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v)
			else params.delete(k)
		}
		params.delete('p')
		goto(`?${params}`)
	}

	function buscar() {
		aplicarParams({ q: busquedaLocal.trim() || null })
	}

	function irPagina(p: number) {
		const params = new URLSearchParams($page.url.searchParams)
		if (p > 1) params.set('p', String(p))
		else params.delete('p')
		goto(`?${params}`)
	}

	function toggleExpand(id: string) {
		expandido = expandido === id ? null : id
	}

	function progreso(items: any[]): { terminados: number; total: number; pct: number } {
		const total = items.length
		const terminados = items.filter((i: any) => i.estado_produccion === 'terminado').length
		return { terminados, total, pct: total > 0 ? Math.round((terminados / total) * 100) : 0 }
	}

	function iniciarSubirDiseno(itemId: string, urlActual: string) {
		subiendoDiseno = itemId
		urlDiseno = urlActual || ''
	}

	// Eliminar pedido
	let eliminandoPedido = $state<string | null>(null)
	let nombreClienteEliminar = $state('')

	let totalPaginas = $derived(Math.ceil(data.total / data.porPagina))
</script>

<svelte:head>
	<title>Pedidos — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">
				{esDiseñador ? 'Mis Pedidos' : 'Pedidos'}
			</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				{data.total} pedido{data.total !== 1 ? 's' : ''}
				{#if esFabricador}
					<span class="text-[var(--text-dim)]">· ordenados por fecha de entrega</span>
				{/if}
			</p>
		</div>
	</div>

	<!-- Búsqueda y filtros -->
	<div class="mt-4 space-y-3">
		{#if esAdmin || esFinanzas}
			<div class="flex gap-2">
				<div class="relative flex-1">
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
					<input
						type="text"
						bind:value={busquedaLocal}
						placeholder="Buscar por nombre de cliente..."
						onkeydown={(e) => { if (e.key === 'Enter') buscar() }}
						class="input-field w-full pl-9 pr-3"
					/>
				</div>
				<button onclick={buscar} class="btn-secondary rounded-lg px-4 py-2 text-sm">Buscar</button>
			</div>
		{/if}

		<div class="flex gap-1 overflow-x-auto">
			{#each filtrosEstado as e}
				<button
					onclick={() => aplicarParams({ estado: e.val })}
					class="filtro-btn whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors"
					class:filtro-activo={data.filtroEstado === e.val}
				>
					{e.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Lista de pedidos -->
	<div class="mt-4 space-y-3">
		{#if data.pedidos.length === 0}
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-16 text-center text-sm text-[var(--text-dim)]">
				No hay pedidos{data.filtroEstado ? ` con estado "${data.filtroEstado}"` : ''}{data.busqueda ? ` para "${data.busqueda}"` : ''}
			</div>
		{/if}

		{#each data.pedidos as pedido (pedido.id)}
			{@const cliente = (pedido as any).clientes}
			{@const creador = (pedido as any).perfiles}
			{@const items = ((pedido as any).pedido_items ?? []).sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))}
			{@const prog = progreso(items)}
			{@const isOpen = expandido === pedido.id}

			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden transition-colors">
				<!-- Fila principal -->
				<button
					onclick={() => toggleExpand(pedido.id)}
					class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
				>
					<!-- Chevron -->
					<svg
						width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						class="shrink-0 text-[var(--text-dim)] transition-transform {isOpen ? 'rotate-90' : ''}"
					><polyline points="9 18 15 12 9 6"/></svg>

					<!-- Cliente + info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<p class="font-medium text-[var(--text)] truncate">
								{cliente?.nombre ?? 'Sin cliente'}
							</p>
							<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {estadoColor[pedido.estado] ?? 'bg-gray-500/15 text-gray-400'}">
								{pedido.estado}
							</span>
							{#if cliente?.contacto}
								<a
									href={`https://wa.me/${cliente.contacto.replace(/\D/g, '')}`}
									target="_blank"
									rel="noopener noreferrer"
									onclick={(e) => e.stopPropagation()}
									class="ml-1 inline-flex items-center justify-center rounded bg-green-500/10 p-1 text-green-400 hover:bg-green-500/20 transition-colors"
									title="Contactar por WhatsApp"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
								</a>
							{/if}
						</div>
						<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-dim)]">
							{#if cliente?.empresa}
								<span>{cliente.empresa}</span>
							{/if}
							{#if creador}
								<span>por {creador.nombre}</span>
							{/if}
							{#if pedido.fecha_entrega}
								<span>Entrega: {fmtFecha(pedido.fecha_entrega)}</span>
							{/if}
							<span>{fmtRelativa(pedido.created_at)}</span>
						</div>
					</div>

					<!-- Progreso -->
					<div class="hidden w-32 shrink-0 sm:block">
						<div class="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
							<span>{prog.terminados}/{prog.total} items</span>
							<span>{prog.pct}%</span>
						</div>
						<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card-2)]">
							<div
								class="h-full rounded-full transition-all {prog.pct === 100 ? 'bg-green-500' : 'bg-[var(--brand)]'}"
								style="width: {prog.pct}%"
							></div>
						</div>
					</div>

					<!-- Precios (solo admin/finanzas) -->
					{#if puedeVerPrecios}
						<div class="hidden shrink-0 text-right md:block">
							<p class="text-sm font-medium text-[var(--text)]">{fmt(pedido.precio_total)}</p>
							{#if pedido.abono > 0}
								<p class="text-[10px] text-[var(--text-dim)]">
									Abono: {fmt(pedido.abono)} · Saldo: {fmt(pedido.saldo)}
								</p>
							{/if}
						</div>
					{/if}
				</button>

				<!-- Panel expandido: items del pedido -->
				{#if isOpen}
					<div class="border-t border-[var(--border)]">
						<!-- Header del admin: cambiar estado + ver detalle -->
						{#if esAdmin}
							<div class="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-3">
								<span class="text-xs text-[var(--text-muted)]">Estado del pedido:</span>
								<form method="POST" action="?/cambiarEstadoPedido" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											mostrarToast('Estado actualizado')
											invalidateAll()
										}
									}
								}}>
									<input type="hidden" name="pedido_id" value={pedido.id} />
									<select
										name="estado"
										onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
										class="input-field rounded-lg py-1 text-xs"
									>
										{#each ESTADOS_PEDIDO as est}
											<option value={est} selected={est === pedido.estado}>{est}</option>
										{/each}
									</select>
								</form>
								<a
									href="/pedidos/{pedido.id}"
									class="ml-auto text-xs text-[var(--brand-light)] hover:underline"
								>Ver detalle completo</a>
								<button
									type="button"
									onclick={() => {
										eliminandoPedido = pedido.id
										nombreClienteEliminar = cliente?.nombre ?? 'este pedido'
									}}
									class="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
									title="Eliminar pedido"
								>
									Eliminar pedido
								</button>
							</div>
						{/if}

						<!-- Items -->
						<div class="divide-y divide-[var(--border)]">
							{#each items as item, idx (item.id)}
								{@const esItemMio = esDiseñador && item.asignado_a === data.userId}
								<div class="px-5 py-3 {esDiseñador && !esItemMio && !esAdmin ? 'opacity-40' : ''}">
									<div class="flex flex-wrap items-start gap-3">
										<!-- Info del item -->
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="text-[10px] text-[var(--text-dim)]">#{idx + 1}</span>
												<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
													{item.tipo_label}
												</span>
												<span class="rounded-full border px-2 py-0.5 text-[10px] font-medium {itemEstadoColor[item.estado_produccion] ?? ''}">
													{ESTADO_ITEM_LABEL[item.estado_produccion as EstadoItem] ?? item.estado_produccion}
												</span>
											</div>
											<p class="mt-1 text-sm text-[var(--text)]">{item.descripcion}</p>

											{#if item.notas_produccion}
												<p class="mt-0.5 text-[10px] text-[var(--text-dim)] italic">{item.notas_produccion}</p>
											{/if}

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
													class="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--brand-light)] hover:underline"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
													Archivo de diseño
												</a>
											{/if}
										</div>

										<!-- Acciones por rol -->
										<div class="flex shrink-0 items-center gap-2">
											<!-- Fabricador: cambiar estado de producción -->
											{#if esFabricador || esAdmin}
												<form method="POST" action="?/cambiarEstadoItem" use:enhance={() => {
													return async ({ result }) => {
														if (result.type === 'success') {
															mostrarToast('Estado del item actualizado')
															invalidateAll()
														}
													}
												}}>
													<input type="hidden" name="item_id" value={item.id} />
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

											<!-- Diseñador: subir archivo de diseño -->
											{#if (esDiseñador && esItemMio) || esAdmin}
												<button
													onclick={() => iniciarSubirDiseno(item.id, item.archivo_diseno_url ?? '')}
													class="btn-secondary rounded-lg px-3 py-1 text-xs"
													title="Subir diseño"
												>
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
												</button>
											{/if}

											<!-- Admin: asignar a usuario -->
											{#if esAdmin}
												<form method="POST" action="?/asignarItem" use:enhance={() => {
													return async ({ result }) => {
														if (result.type === 'success') {
															mostrarToast('Item asignado')
															invalidateAll()
														}
													}
												}}>
													<input type="hidden" name="item_id" value={item.id} />
													<select
														name="user_id"
														onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
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
												</form>
											{/if}
										</div>
									</div>
								</div>
							{/each}

							{#if items.length === 0}
								<div class="px-5 py-6 text-center text-sm text-[var(--text-dim)]">Sin productos</div>
							{/if}
						</div>

						<!-- Progreso resumido en móvil -->
						<div class="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 sm:hidden">
							<span class="text-xs text-[var(--text-muted)]">{prog.terminados}/{prog.total} items terminados</span>
							<div class="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-card-2)]">
								<div
									class="h-full rounded-full {prog.pct === 100 ? 'bg-green-500' : 'bg-[var(--brand)]'}"
									style="width: {prog.pct}%"
								></div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
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

<!-- Modal: Confirmar eliminación de pedido -->
{#if eliminandoPedido}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => (eliminandoPedido = null)}>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--text)]">Eliminar pedido</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				¿Eliminar el pedido de <span class="font-medium text-[var(--text)]">{nombreClienteEliminar}</span>? Esta acción no se puede deshacer.
			</p>
			<form method="POST" action="?/eliminarPedido" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Pedido eliminado')
						eliminandoPedido = null
						invalidateAll()
					}
				}
			}}>
				<input type="hidden" name="pedido_id" value={eliminandoPedido} />
				<div class="mt-5 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (eliminandoPedido = null)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button
						type="submit"
						class="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
					>Eliminar</button>
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
		color: #fff;
		transition: background 0.15s;
	}
	.btn-primary:hover {
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
