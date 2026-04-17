<script lang="ts">
	import { onMount } from 'svelte'
	import { goto, invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { enhance } from '$app/forms'
	import { supabase } from '$lib/supabase'
	import { mostrarToast } from '$lib/stores/ui'
	import { fmt, fmtFecha, fmtRelativa } from '$lib/utils/format'
	import type { PageData } from './$types'
	import type { Cliente, Cotizacion, Pedido } from '$lib/types'

	let { data }: { data: PageData } = $props()

	const esAdmin = $derived(data.rol === 'admin')

	// Eliminar cliente
	let eliminandoCliente = $state<string | null>(null)
	let nombreClienteEliminar = $state('')

	// ── Estado de búsqueda y filtros ──
	let inputBusqueda = $state(data.busqueda)
	let timerBusqueda: ReturnType<typeof setTimeout>

	function buscar() {
		clearTimeout(timerBusqueda)
		timerBusqueda = setTimeout(() => {
			const params = new URLSearchParams($page.url.searchParams)
			if (inputBusqueda) params.set('q', inputBusqueda)
			else params.delete('q')
			params.delete('p')
			goto(`?${params}`, { keepFocus: true })
		}, 350)
	}

	function cambiarFiltro(valor: string | null) {
		const params = new URLSearchParams($page.url.searchParams)
		if (valor) params.set('activo', valor)
		else params.delete('activo')
		params.delete('p')
		goto(`?${params}`)
	}

	function irPagina(p: number) {
		const params = new URLSearchParams($page.url.searchParams)
		if (p > 1) params.set('p', String(p))
		else params.delete('p')
		goto(`?${params}`)
	}

	let totalPaginas = $derived(Math.ceil(data.total / data.porPagina))

	// ── Drawer: nuevo cliente ──
	let drawerAbierto = $state(false)
	let guardandoNuevo = $state(false)
	let nuevoCliente = $state({
		nombre: '',
		contacto: '',
		email: '',
		empresa: '',
		ciudad: '',
		notas: ''
	})

	function resetNuevo() {
		nuevoCliente = { nombre: '', contacto: '', email: '', empresa: '', ciudad: '', notas: '' }
	}

	async function crearCliente() {
		if (!nuevoCliente.nombre.trim()) return mostrarToast('El nombre es obligatorio', 'error')
		guardandoNuevo = true
		const { error } = await supabase.from('clientes').insert({
			nombre: nuevoCliente.nombre.trim(),
			contacto: nuevoCliente.contacto.trim() || null,
			email: nuevoCliente.email.trim() || null,
			empresa: nuevoCliente.empresa.trim() || null,
			ciudad: nuevoCliente.ciudad.trim() || null,
			notas: nuevoCliente.notas.trim() || null
		})
		guardandoNuevo = false
		if (error) return mostrarToast('Error al crear cliente', 'error')
		mostrarToast('Cliente creado')
		drawerAbierto = false
		resetNuevo()
		invalidateAll()
	}

	// ── Ficha del cliente seleccionado ──
	let clienteSeleccionado = $state<Cliente | null>(null)
	let editando = $state(false)
	let guardandoEdicion = $state(false)
	let camposEdicion = $state({ nombre: '', contacto: '', email: '', empresa: '', ciudad: '', notas: '' })

	// Historial
	let cotizacionesCliente = $state<Cotizacion[]>([])
	let pedidosCliente = $state<Pedido[]>([])
	let totalComprado = $state(0)
	let cargandoFicha = $state(false)

	async function seleccionarCliente(cliente: Cliente) {
		clienteSeleccionado = cliente
		editando = false
		cargandoFicha = true

		const [cotRes, pedRes] = await Promise.all([
			supabase
				.from('cotizaciones')
				.select('id, estado, precio_total, created_at')
				.eq('cliente_id', cliente.id)
				.order('created_at', { ascending: false })
				.limit(10),
			supabase
				.from('pedidos')
				.select('id, estado, precio_total, created_at')
				.eq('cliente_id', cliente.id)
				.order('created_at', { ascending: false })
				.limit(10)
		])

		cotizacionesCliente = (cotRes.data ?? []) as Cotizacion[]
		pedidosCliente = (pedRes.data ?? []) as Pedido[]
		totalComprado = pedidosCliente.reduce((s, p) => s + Number(p.precio_total), 0)
		cargandoFicha = false
	}

	function iniciarEdicion() {
		if (!clienteSeleccionado) return
		camposEdicion = {
			nombre: clienteSeleccionado.nombre,
			contacto: clienteSeleccionado.contacto ?? '',
			email: clienteSeleccionado.email ?? '',
			empresa: clienteSeleccionado.empresa ?? '',
			ciudad: clienteSeleccionado.ciudad ?? '',
			notas: clienteSeleccionado.notas ?? ''
		}
		editando = true
	}

	async function guardarEdicion() {
		if (!clienteSeleccionado || !camposEdicion.nombre.trim())
			return mostrarToast('El nombre es obligatorio', 'error')
		guardandoEdicion = true
		const { error } = await supabase
			.from('clientes')
			.update({
				nombre: camposEdicion.nombre.trim(),
				contacto: camposEdicion.contacto.trim() || null,
				email: camposEdicion.email.trim() || null,
				empresa: camposEdicion.empresa.trim() || null,
				ciudad: camposEdicion.ciudad.trim() || null,
				notas: camposEdicion.notas.trim() || null
			})
			.eq('id', clienteSeleccionado.id)
		guardandoEdicion = false
		if (error) return mostrarToast('Error al guardar', 'error')
		mostrarToast('Cliente actualizado')
		// Actualizar in-place
		clienteSeleccionado = {
			...clienteSeleccionado,
			nombre: camposEdicion.nombre.trim(),
			contacto: camposEdicion.contacto.trim() || null,
			email: camposEdicion.email.trim() || null,
			empresa: camposEdicion.empresa.trim() || null,
			ciudad: camposEdicion.ciudad.trim() || null,
			notas: camposEdicion.notas.trim() || null
		}
		editando = false
		invalidateAll()
	}

	async function toggleActivo() {
		if (!clienteSeleccionado) return
		const nuevoEstado = !clienteSeleccionado.activo
		const { error } = await supabase
			.from('clientes')
			.update({ activo: nuevoEstado })
			.eq('id', clienteSeleccionado.id)
		if (error) return mostrarToast('Error al actualizar estado', 'error')
		clienteSeleccionado = { ...clienteSeleccionado, activo: nuevoEstado }
		mostrarToast(nuevoEstado ? 'Cliente activado' : 'Cliente desactivado')
		invalidateAll()
	}

	function cerrarFicha() {
		clienteSeleccionado = null
		editando = false
	}

	// Colores de estado para cotizaciones y pedidos
	const estadoCotColor: Record<string, string> = {
		pendiente: 'bg-yellow-500/15 text-yellow-400',
		aprobada: 'bg-green-500/15 text-green-400',
		convertida: 'bg-blue-500/15 text-blue-400',
		cancelada: 'bg-red-500/15 text-red-400'
	}
	const estadoPedColor: Record<string, string> = {
		'Pedido realizado': 'bg-gray-500/15 text-gray-400',
		'En proceso': 'bg-blue-500/15 text-blue-400',
		'Enviado a proveedor': 'bg-purple-500/15 text-purple-400',
		'En fabricación': 'bg-yellow-500/15 text-yellow-400',
		Terminado: 'bg-green-500/15 text-green-400',
		Entregado: 'bg-emerald-500/15 text-emerald-300'
	}

	// Realtime
	onMount(() => {
		const channel = supabase
			.channel('clientes-realtime')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
				invalidateAll()
			})
			.subscribe()
		return () => { supabase.removeChannel(channel) }
	})
</script>

<svelte:head>
	<title>Clientes — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Clientes</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">{data.total} cliente{data.total !== 1 ? 's' : ''}</p>
		</div>
		<button
			onclick={() => { resetNuevo(); drawerAbierto = true }}
			class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Nuevo cliente
		</button>
	</div>

	<!-- Buscador + filtros -->
	<div class="mt-4 flex flex-col gap-3 sm:flex-row">
		<div class="relative flex-1">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input
				type="text"
				placeholder="Buscar por nombre, empresa, email..."
				bind:value={inputBusqueda}
				oninput={buscar}
				class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-10 pr-3 text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none transition-colors focus:border-[var(--brand)]"
			/>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => cambiarFiltro(null)}
				class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === null ? 'filtro-activo' : ''}"
			>Todos</button>
			<button
				onclick={() => cambiarFiltro('true')}
				class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'true' ? 'filtro-activo' : ''}"
			>Activos</button>
			<button
				onclick={() => cambiarFiltro('false')}
				class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'false' ? 'filtro-activo' : ''}"
			>Inactivos</button>
		</div>
	</div>

	<!-- Tabla de clientes -->
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
		{#if data.clientes.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				{data.busqueda ? 'Sin resultados para esa búsqueda' : 'No hay clientes registrados'}
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
						<th class="px-4 py-3 font-medium">Nombre</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Empresa</th>
						<th class="hidden px-4 py-3 font-medium md:table-cell">Ciudad</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">Contacto</th>
						<th class="px-4 py-3 font-medium">Estado</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Creado</th>
					</tr>
				</thead>
				<tbody>
					{#each data.clientes as cliente (cliente.id)}
						<tr
							class="table-row cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors"
							class:table-row-selected={clienteSeleccionado?.id === cliente.id}
							onclick={() => seleccionarCliente(cliente)}
						>
							<td class="px-4 py-3">
								<p class="font-medium text-[var(--text)]">{cliente.nombre}</p>
								{#if cliente.email}
									<p class="text-xs text-[var(--text-dim)]">{cliente.email}</p>
								{/if}
							</td>
							<td class="hidden px-4 py-3 text-[var(--text-muted)] sm:table-cell">{cliente.empresa ?? '—'}</td>
							<td class="hidden px-4 py-3 text-[var(--text-muted)] md:table-cell">{cliente.ciudad ?? '—'}</td>
							<td class="hidden px-4 py-3 text-[var(--text-muted)] lg:table-cell">{cliente.contacto ?? '—'}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {cliente.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
									{cliente.activo ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="hidden px-4 py-3 text-[var(--text-dim)] sm:table-cell">{fmtFecha(cliente.created_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Paginación -->
	{#if totalPaginas > 1}
		<div class="mt-4 flex items-center justify-between text-sm">
			<p class="text-[var(--text-dim)]">
				Página {data.pagina} de {totalPaginas}
			</p>
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

<!-- ═══════════════════ DRAWER: NUEVO CLIENTE ═══════════════════ -->
{#if drawerAbierto}
	<!-- Overlay -->
	<div class="fixed inset-0 z-40 bg-black/50" onclick={() => (drawerAbierto = false)}></div>
	<!-- Panel -->
	<aside class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)]">
		<div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
			<h2 class="text-lg font-semibold text-[var(--text)]">Nuevo cliente</h2>
			<button onclick={() => (drawerAbierto = false)} class="text-[var(--text-muted)] hover:text-[var(--text)]">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
		<div class="flex-1 overflow-y-auto p-6">
			<div class="space-y-4">
				<div>
					<label for="nuevo-nombre" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre *</label>
					<input id="nuevo-nombre" type="text" bind:value={nuevoCliente.nombre} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
				</div>
				<div>
					<label for="nuevo-contacto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Teléfono / Contacto</label>
					<input id="nuevo-contacto" type="text" bind:value={nuevoCliente.contacto} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
				</div>
				<div>
					<label for="nuevo-email" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
					<input id="nuevo-email" type="email" bind:value={nuevoCliente.email} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
				</div>
				<div>
					<label for="nuevo-empresa" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Empresa</label>
					<input id="nuevo-empresa" type="text" bind:value={nuevoCliente.empresa} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
				</div>
				<div>
					<label for="nuevo-ciudad" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Ciudad</label>
					<input id="nuevo-ciudad" type="text" bind:value={nuevoCliente.ciudad} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
				</div>
				<div>
					<label for="nuevo-notas" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas</label>
					<textarea id="nuevo-notas" rows="3" bind:value={nuevoCliente.notas} class="input-field w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"></textarea>
				</div>
			</div>
		</div>
		<div class="border-t border-[var(--border)] px-6 py-4">
			<button
				onclick={crearCliente}
				disabled={guardandoNuevo}
				class="btn-primary w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
			>
				{guardandoNuevo ? 'Guardando...' : 'Crear cliente'}
			</button>
		</div>
	</aside>
{/if}

<!-- ═══════════════════ FICHA DEL CLIENTE ═══════════════════ -->
{#if clienteSeleccionado}
	<!-- Overlay -->
	<div class="fixed inset-0 z-40 bg-black/50" onclick={cerrarFicha}></div>
	<!-- Panel -->
	<aside class="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--bg)]">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)]/20 text-sm font-semibold text-[var(--brand-light)]">
					{clienteSeleccionado.nombre.charAt(0).toUpperCase()}
				</div>
				<div>
					<h2 class="text-lg font-semibold text-[var(--text)]">{clienteSeleccionado.nombre}</h2>
					<p class="text-xs text-[var(--text-dim)]">
						Cliente desde {fmtFecha(clienteSeleccionado.created_at)}
					</p>
				</div>
			</div>
			<button onclick={cerrarFicha} class="text-[var(--text-muted)] hover:text-[var(--text)]">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if cargandoFicha}
				<div class="flex items-center justify-center py-20 text-sm text-[var(--text-dim)]">Cargando...</div>
			{:else}
				<!-- Resumen rápido -->
				<div class="grid grid-cols-3 gap-3 border-b border-[var(--border)] px-6 py-4">
					<div class="text-center">
						<p class="text-lg font-semibold text-[var(--text)]">{fmt(totalComprado)}</p>
						<p class="text-[10px] text-[var(--text-dim)]">Total comprado</p>
					</div>
					<div class="text-center">
						<p class="text-lg font-semibold text-[var(--text)]">{pedidosCliente.length}</p>
						<p class="text-[10px] text-[var(--text-dim)]">Pedidos</p>
					</div>
					<div class="text-center">
						<p class="text-lg font-semibold text-[var(--text)]">{cotizacionesCliente.length}</p>
						<p class="text-[10px] text-[var(--text-dim)]">Cotizaciones</p>
					</div>
				</div>

				<!-- Datos de contacto -->
				<div class="border-b border-[var(--border)] px-6 py-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Datos de contacto</h3>
						{#if !editando}
							<div class="flex gap-2">
								{#if esAdmin}
									<button
										onclick={() => {
											eliminandoCliente = clienteSeleccionado?.id ?? null
											nombreClienteEliminar = clienteSeleccionado?.nombre ?? ''
										}}
										class="text-xs text-red-400 hover:text-red-300"
									>Eliminar</button>
								{/if}
								<button onclick={toggleActivo} class="text-xs text-[var(--text-dim)] hover:text-[var(--text)]">
									{clienteSeleccionado.activo ? 'Desactivar' : 'Activar'}
								</button>
								<button onclick={iniciarEdicion} class="text-xs text-[var(--brand-light)] hover:underline">Editar</button>
							</div>
						{/if}
					</div>

					{#if editando}
						<div class="space-y-3">
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Nombre *</label>
								<input type="text" bind:value={camposEdicion.nombre} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Teléfono</label>
								<input type="text" bind:value={camposEdicion.contacto} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Email</label>
								<input type="email" bind:value={camposEdicion.email} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Empresa</label>
								<input type="text" bind:value={camposEdicion.empresa} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Ciudad</label>
								<input type="text" bind:value={camposEdicion.ciudad} class="input-field w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] text-[var(--text-dim)]">Notas</label>
								<textarea rows="2" bind:value={camposEdicion.notas} class="input-field w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]"></textarea>
							</div>
							<div class="flex gap-2">
								<button onclick={guardarEdicion} disabled={guardandoEdicion} class="btn-primary rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50">
									{guardandoEdicion ? 'Guardando...' : 'Guardar'}
								</button>
								<button onclick={() => (editando = false)} class="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card)]">
									Cancelar
								</button>
							</div>
						</div>
					{:else}
						<dl class="space-y-2 text-sm">
							<div class="flex justify-between">
								<dt class="text-[var(--text-dim)]">Teléfono</dt>
								<dd class="text-[var(--text)]">{clienteSeleccionado.contacto ?? '—'}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--text-dim)]">Email</dt>
								<dd class="text-[var(--text)]">{clienteSeleccionado.email ?? '—'}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--text-dim)]">Empresa</dt>
								<dd class="text-[var(--text)]">{clienteSeleccionado.empresa ?? '—'}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--text-dim)]">Ciudad</dt>
								<dd class="text-[var(--text)]">{clienteSeleccionado.ciudad ?? '—'}</dd>
							</div>
							{#if clienteSeleccionado.notas}
								<div>
									<dt class="mb-1 text-[var(--text-dim)]">Notas</dt>
									<dd class="whitespace-pre-wrap text-[var(--text)]">{clienteSeleccionado.notas}</dd>
								</div>
							{/if}
							<div class="flex justify-between">
								<dt class="text-[var(--text-dim)]">Estado</dt>
								<dd>
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {clienteSeleccionado.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
										{clienteSeleccionado.activo ? 'Activo' : 'Inactivo'}
									</span>
								</dd>
							</div>
						</dl>
					{/if}
				</div>

				<!-- Historial de pedidos -->
				<div class="border-b border-[var(--border)] px-6 py-4">
					<h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Pedidos</h3>
					{#if pedidosCliente.length === 0}
						<p class="py-4 text-center text-xs text-[var(--text-dim)]">Sin pedidos</p>
					{:else}
						<ul class="space-y-1">
							{#each pedidosCliente as pedido}
								<li>
									<a href="/pedidos/{pedido.id}" class="pedido-row flex items-center justify-between rounded-lg px-3 py-2 transition-colors">
										<div>
											<p class="text-sm text-[var(--text)]">{fmt(pedido.precio_total)}</p>
											<p class="text-[10px] text-[var(--text-dim)]">{fmtRelativa(pedido.created_at)}</p>
										</div>
										<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {estadoPedColor[pedido.estado] ?? 'bg-gray-500/15 text-gray-400'}">
											{pedido.estado}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- Historial de cotizaciones -->
				<div class="px-6 py-4">
					<h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Cotizaciones</h3>
					{#if cotizacionesCliente.length === 0}
						<p class="py-4 text-center text-xs text-[var(--text-dim)]">Sin cotizaciones</p>
					{:else}
						<ul class="space-y-1">
							{#each cotizacionesCliente as cot}
								<li>
									<a href="/cotizaciones/{cot.id}" class="pedido-row flex items-center justify-between rounded-lg px-3 py-2 transition-colors">
										<div>
											<p class="text-sm text-[var(--text)]">{fmt(cot.precio_total)}</p>
											<p class="text-[10px] text-[var(--text-dim)]">{fmtRelativa(cot.created_at)}</p>
										</div>
										<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {estadoCotColor[cot.estado] ?? 'bg-gray-500/15 text-gray-400'}">
											{cot.estado}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	</aside>
{/if}

<!-- Modal: Confirmar eliminación de cliente -->
{#if eliminandoCliente}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onclick={() => (eliminandoCliente = null)}>
		<div class="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--text)]">Eliminar cliente</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				¿Eliminar a <span class="font-medium text-[var(--text)]">{nombreClienteEliminar}</span>? Se eliminarán también sus pedidos y cotizaciones. Esta acción no se puede deshacer.
			</p>
			<form method="POST" action="?/eliminarCliente" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Cliente eliminado')
						eliminandoCliente = null
						clienteSeleccionado = null
						invalidateAll()
					} else if (result.type === 'failure') {
						mostrarToast((result.data as any)?.error ?? 'Error al eliminar', 'error')
					}
				}
			}}>
				<input type="hidden" name="cliente_id" value={eliminandoCliente} />
				<div class="mt-5 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (eliminandoCliente = null)}
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

<style>
	.btn-primary {
		background: var(--brand);
		color: #080808;
		transition: background 0.15s;
	}
	.btn-primary:hover {
		background: var(--brand-light);
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

	.table-row:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.table-row-selected {
		background: color-mix(in srgb, var(--brand) 8%, transparent) !important;
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

	.pedido-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}
</style>
