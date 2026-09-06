<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const proveedores = $derived(data.proveedores ?? [])
	const totalDeuda = $derived(proveedores.reduce((s: number, p: any) => s + Math.max(0, Number(p.deuda ?? 0)), 0))

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

	function cambiarFiltro(valor: string | null) {
		const params = new URLSearchParams($page.url.searchParams)
		if (valor) params.set('activo', valor)
		else params.delete('activo')
		goto(`?${params}`)
	}

	// Drawer nuevo proveedor
	let creando = $state(false)
	let guardando = $state(false)
	let nuevoNombre = $state('')
	let nuevoContacto = $state('')
	let nuevoEmail = $state('')
	let nuevaCiudad = $state('')
	let nuevasNotas = $state('')

	function resetForm() {
		nuevoNombre = ''
		nuevoContacto = ''
		nuevoEmail = ''
		nuevaCiudad = ''
		nuevasNotas = ''
	}
</script>

<svelte:head>
	<title>Proveedores — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-2">
			<a href="/financiera" class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Volver a Financiera">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div>
				<h1 class="text-xl font-semibold text-[var(--text)]">Proveedores</h1>
				<p class="mt-1 text-sm text-[var(--text-muted)]">{proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} · Deuda total {fmt(totalDeuda)}</p>
			</div>
		</div>
		<button
			onclick={() => { resetForm(); creando = true }}
			class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Nuevo proveedor
		</button>
	</div>

	<!-- Buscador + filtros -->
	<div class="mt-4 flex flex-col gap-3 sm:flex-row">
		<div class="relative flex-1">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input
				type="text"
				placeholder="Buscar por nombre, contacto, email..."
				bind:value={inputBusqueda}
				oninput={buscar}
				class="input-field w-full rounded-lg py-2 pl-10 pr-3 text-sm"
			/>
		</div>
		<div class="flex gap-2">
			<button onclick={() => cambiarFiltro(null)} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === null ? 'filtro-activo' : ''}">Todos</button>
			<button onclick={() => cambiarFiltro('true')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'true' ? 'filtro-activo' : ''}">Activos</button>
			<button onclick={() => cambiarFiltro('false')} class="filtro-btn rounded-lg px-3 py-2 text-sm {data.filtroActivo === 'false' ? 'filtro-activo' : ''}">Inactivos</button>
		</div>
	</div>

	<!-- Tabla -->
	<div class="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
		{#if proveedores.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				{data.busqueda ? 'Sin resultados para esa búsqueda' : 'No hay proveedores registrados'}
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
						<th class="px-4 py-3 font-medium">Nombre</th>
						<th class="px-4 py-3 font-medium text-right">Deuda</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">Contacto</th>
						<th class="px-4 py-3 font-medium">Estado</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Creado</th>
					</tr>
				</thead>
				<tbody>
					{#each proveedores as proveedor (proveedor.id)}
						<tr
							class="table-row cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors"
							onclick={() => goto(`/financiera/proveedores/${proveedor.id}`)}
						>
							<td class="px-4 py-3">
								<p class="font-medium text-[var(--text)]">{proveedor.nombre}</p>
								{#if proveedor.email}
									<p class="text-xs text-[var(--text-dim)]">{proveedor.email}</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-medium {Number(proveedor.deuda) > 0 ? 'text-red-400' : 'text-green-400'}">{fmt(proveedor.deuda)}</td>
							<td class="hidden px-4 py-3 text-[var(--text-muted)] lg:table-cell">{proveedor.contacto ?? '—'}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {proveedor.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
									{proveedor.activo ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="hidden px-4 py-3 text-[var(--text-dim)] sm:table-cell">{fmtFecha(proveedor.created_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<!-- Drawer nuevo proveedor -->
{#if creando}
	<div class="fixed inset-0 z-40 bg-black/50" onclick={() => (creando = false)}></div>
	<aside class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)]">
		<div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
			<h2 class="text-lg font-semibold text-[var(--text)]">Nuevo proveedor</h2>
			<button onclick={() => (creando = false)} class="text-[var(--text-muted)] hover:text-[var(--text)]">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
		<form method="POST" action="?/crear" use:enhance={() => {
			guardando = true
			return async ({ result, update }) => {
				guardando = false
				if (result.type === 'redirect') {
					mostrarToast('Proveedor creado')
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
					<input id="nuevo-nombre" name="nombre" type="text" bind:value={nuevoNombre} required class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-contacto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Teléfono / Contacto</label>
					<input id="nuevo-contacto" name="contacto" type="text" bind:value={nuevoContacto} class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-email" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
					<input id="nuevo-email" name="email" type="email" bind:value={nuevoEmail} class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-ciudad" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Ciudad</label>
					<input id="nuevo-ciudad" name="ciudad" type="text" bind:value={nuevaCiudad} class="input-field w-full" />
				</div>
				<div>
					<label for="nuevo-notas" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas</label>
					<textarea id="nuevo-notas" name="notas" rows="3" bind:value={nuevasNotas} class="input-field w-full resize-none"></textarea>
				</div>
			</div>
			<div class="border-t border-[var(--border)] px-6 py-4">
				<button type="submit" disabled={guardando || !nuevoNombre.trim()} class="btn-primary w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
					{guardando ? 'Guardando...' : 'Crear proveedor'}
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
