<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const acreedores = $derived(data.acreedores ?? [])

	const tipoLabel: Record<string, string> = {
		personal: 'Personal',
		negocio: 'Del negocio'
	}

	let inputBusqueda = $state(data.busqueda)
	let timerBusqueda: ReturnType<typeof setTimeout>

	function buscar() {
		clearTimeout(timerBusqueda)
		timerBusqueda = setTimeout(() => {
			const params = new URLSearchParams($page.url.searchParams)
			if (inputBusqueda) params.set('q', inputBusqueda)
			else params.delete('q')
			goto(`?${params}`, { keepFocus: true })
		}, 350)
	}

	function cambiarFiltroActivo(valor: string | null) {
		const params = new URLSearchParams($page.url.searchParams)
		if (valor) params.set('activo', valor)
		else params.delete('activo')
		goto(`?${params}`)
	}

	function cambiarFiltroTipo(valor: string | null) {
		const params = new URLSearchParams($page.url.searchParams)
		if (valor) params.set('tipo', valor)
		else params.delete('tipo')
		goto(`?${params}`)
	}

	// Drawer nueva deuda
	let creando = $state(false)
	let guardando = $state(false)
	let nuevoNombre = $state('')
	let nuevoTipo = $state<'personal' | 'negocio'>('personal')
	let nuevoContacto = $state('')
	let nuevasNotas = $state('')

	function resetForm() {
		nuevoNombre = ''
		nuevoTipo = 'personal'
		nuevoContacto = ''
		nuevasNotas = ''
	}
</script>

<svelte:head>
	<title>Deudas personales — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-2">
			<a href="/financiera" class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Volver a Financiera">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div>
				<h1 class="text-xl font-semibold text-[var(--text)]">Deudas personales</h1>
				<p class="mt-1 text-sm text-[var(--text-muted)]">{acreedores.length} registro{acreedores.length !== 1 ? 's' : ''}</p>
			</div>
		</div>
		<button
			onclick={() => { resetForm(); creando = true }}
			class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Nueva deuda
		</button>
	</div>

	<!-- Totales -->
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Debo yo (personal)</p>
			<p class="mt-1 text-2xl font-bold {data.totalPersonal > 0 ? 'text-red-400' : 'text-green-400'}">{fmt(data.totalPersonal)}</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Debe el negocio</p>
			<p class="mt-1 text-2xl font-bold {data.totalNegocio > 0 ? 'text-red-400' : 'text-green-400'}">{fmt(data.totalNegocio)}</p>
		</div>
	</div>

	<!-- Buscador + filtros -->
	<div class="mt-4 flex flex-col gap-3 sm:flex-row">
		<div class="relative flex-1">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input
				type="text"
				placeholder="Buscar por nombre o contacto..."
				bind:value={inputBusqueda}
				oninput={buscar}
				class="input-field w-full rounded-lg py-2 pl-10 pr-3 text-sm"
			/>
		</div>
		<div class="flex flex-wrap gap-2">
			<button onclick={() => cambiarFiltroTipo(null)} class="filtro-btn rounded-lg px-3 py-2 text-sm {!data.filtroTipo ? 'filtro-activo' : ''}">Todos</button>
			<button onclick={() => cambiarFiltroTipo('personal')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroTipo === 'personal' ? 'filtro-activo' : ''}">Personal</button>
			<button onclick={() => cambiarFiltroTipo('negocio')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroTipo === 'negocio' ? 'filtro-activo' : ''}">Del negocio</button>
			<button onclick={() => cambiarFiltroActivo(null)} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === null ? 'filtro-activo' : ''}">Todos</button>
			<button onclick={() => cambiarFiltroActivo('true')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'true' ? 'filtro-activo' : ''}">Activas</button>
			<button onclick={() => cambiarFiltroActivo('false')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'false' ? 'filtro-activo' : ''}">Inactivas</button>
		</div>
	</div>

	<!-- Tabla -->
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
		{#if acreedores.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				{data.busqueda ? 'Sin resultados para esa búsqueda' : 'No hay deudas registradas'}
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
						<th class="px-4 py-3 font-medium">Nombre</th>
						<th class="px-4 py-3 font-medium">Tipo</th>
						<th class="px-4 py-3 font-medium text-right">Deuda</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">Contacto</th>
						<th class="px-4 py-3 font-medium">Estado</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Creado</th>
					</tr>
				</thead>
				<tbody>
					{#each acreedores as acreedor (acreedor.id)}
						<tr
							class="table-row cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors"
							onclick={() => goto(`/financiera/deudas-personales/${acreedor.id}`)}
						>
							<td class="px-4 py-3">
								<p class="font-medium text-[var(--text)]">{acreedor.nombre}</p>
							</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {acreedor.tipo === 'personal' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}">
									{tipoLabel[acreedor.tipo] ?? acreedor.tipo}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-medium {Number(acreedor.deuda) > 0 ? 'text-red-400' : 'text-green-400'}">{fmt(acreedor.deuda)}</td>
							<td class="hidden px-4 py-3 text-[var(--text-muted)] lg:table-cell">{acreedor.contacto ?? '—'}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {acreedor.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
									{acreedor.activo ? 'Activa' : 'Inactiva'}
								</span>
							</td>
							<td class="hidden px-4 py-3 text-[var(--text-dim)] sm:table-cell">{fmtFecha(acreedor.created_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<!-- Drawer nueva deuda -->
{#if creando}
	<div class="fixed inset-0 z-40 bg-black/50" onclick={() => (creando = false)}></div>
	<aside class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)]">
		<div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
			<h2 class="text-lg font-semibold text-[var(--text)]">Nueva deuda</h2>
			<button onclick={() => (creando = false)} class="text-[var(--text-muted)] hover:text-[var(--text)]">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
		<form method="POST" action="?/crear" use:enhance={() => {
			guardando = true
			return async ({ result, update }) => {
				guardando = false
				if (result.type === 'redirect') {
					mostrarToast('Deuda creada')
					creando = false
				} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
					mostrarToast(result.data.error, 'error')
				}
				await update()
			}
		}} class="flex flex-1 flex-col overflow-y-auto">
			<div class="flex-1 space-y-4 p-6">
				<div>
					<label for="nuevo-nombre" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre *</label>
					<input id="nuevo-nombre" name="nombre" type="text" bind:value={nuevoNombre} required placeholder="Ej: Tarjeta Bancolombia, Préstamo de Juan..." class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-tipo" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo</label>
					<select id="nuevo-tipo" name="tipo" bind:value={nuevoTipo} class="input-field w-full">
						<option value="personal">Personal</option>
						<option value="negocio">Del negocio</option>
					</select>
				</div>
				<div>
					<label for="nuevo-contacto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Teléfono / Contacto</label>
					<input id="nuevo-contacto" name="contacto" type="text" bind:value={nuevoContacto} class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-notas" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas</label>
					<textarea id="nuevo-notas" name="notas" rows="3" bind:value={nuevasNotas} class="input-field w-full resize-none"></textarea>
				</div>
			</div>
			<div class="border-t border-[var(--border)] px-6 py-4">
				<button type="submit" disabled={guardando || !nuevoNombre.trim()} class="btn-primary w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
					{guardando ? 'Guardando...' : 'Crear deuda'}
				</button>
			</div>
		</form>
	</aside>
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
