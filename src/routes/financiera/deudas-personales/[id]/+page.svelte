<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const acreedor = $derived(data.acreedor)
	const creditos = $derived(data.creditos ?? [])
	const pagos = $derived(data.pagos ?? [])
	const bancos = $derived(data.bancos ?? [])
	const esAdmin = $derived(data.rol === 'admin')

	const tipoLabel: Record<string, string> = {
		personal: 'Personal',
		negocio: 'Del negocio'
	}

	// Edición
	let editando = $state(false)
	let editNombre = $state('')
	let editTipo = $state<'personal' | 'negocio'>('personal')
	let editContacto = $state('')
	let editNotas = $state('')
	let editActivo = $state(true)

	$effect(() => {
		if (!editando) {
			editNombre = acreedor.nombre
			editTipo = acreedor.tipo
			editContacto = acreedor.contacto ?? ''
			editNotas = acreedor.notas ?? ''
			editActivo = acreedor.activo
		}
	})

	// Modal agregar crédito
	let agregandoCredito = $state(false)
	let creditoConcepto = $state('')
	let creditoMonto = $state(0)
	let creditoFecha = $state(new Date().toISOString().slice(0, 10))

	// Modal agregar pago
	let agregandoPago = $state(false)
	let pagoMonto = $state(0)
	let pagoConcepto = $state('')
	let pagoBancoId = $state('')
	let pagoFecha = $state(new Date().toISOString().slice(0, 10))
</script>

<svelte:head>
	<title>{acreedor.nombre} — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex items-center gap-3">
			<a href="/financiera/deudas-personales" class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Volver">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div class="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand)]/20 text-sm font-semibold text-[var(--brand-light)]">
				{acreedor.nombre.charAt(0).toUpperCase()}
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-xl font-semibold text-[var(--text)]">{acreedor.nombre}</h1>
					<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {acreedor.tipo === 'personal' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}">
						{tipoLabel[acreedor.tipo] ?? acreedor.tipo}
					</span>
					{#if !acreedor.activo}
						<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">Inactivo</span>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-[var(--text-dim)]">{acreedor.contacto ?? '—'}</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<button type="button" onclick={() => (editando = !editando)} class="btn-secondary rounded-lg px-3 py-1.5 text-sm">
				{editando ? 'Cancelar' : 'Editar'}
			</button>
			<button
				type="button"
				onclick={() => { agregandoCredito = true; creditoConcepto = ''; creditoMonto = 0; creditoFecha = new Date().toISOString().slice(0,10) }}
				class="btn-secondary rounded-lg px-3 py-1.5 text-sm"
			>+ Crédito</button>
			<button
				type="button"
				onclick={() => { agregandoPago = true; pagoMonto = 0; pagoConcepto = ''; pagoBancoId = bancos[0]?.id ?? ''; pagoFecha = new Date().toISOString().slice(0,10) }}
				class="btn-primary flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium"
			>Registrar pago</button>
		</div>
	</div>

	<!-- Resumen -->
	<div class="mt-5 grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Deuda actual</p>
			<p class="mt-1 text-2xl font-bold {Number(acreedor.deuda) > 0 ? 'text-red-400' : 'text-green-400'}">
				{fmt(acreedor.deuda)}
			</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Total créditos</p>
			<p class="mt-1 text-2xl font-semibold text-[var(--text)]">{fmt(acreedor.total_creditos)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">{creditos.length} registro{creditos.length === 1 ? '' : 's'}</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Total pagado</p>
			<p class="mt-1 text-2xl font-semibold text-green-400">{fmt(acreedor.total_pagos)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">{pagos.length} pago{pagos.length === 1 ? '' : 's'}</p>
		</div>
	</div>

	<!-- Formulario edición -->
	{#if editando}
		<form method="POST" action="?/actualizar" use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					mostrarToast('Deuda actualizada')
					editando = false
					invalidateAll()
				} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
					mostrarToast(result.data.error, 'error')
				}
			}
		}} class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<input type="hidden" name="acreedor_id" value={acreedor.id} />

			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre *</label>
					<input name="nombre" type="text" bind:value={editNombre} required class="input-field w-full" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo</label>
					<select name="tipo" bind:value={editTipo} class="input-field w-full">
						<option value="personal">Personal</option>
						<option value="negocio">Del negocio</option>
					</select>
				</div>
				<div class="sm:col-span-2">
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Teléfono / Contacto</label>
					<input name="contacto" type="text" bind:value={editContacto} class="input-field w-full" />
				</div>
			</div>

			<div class="mt-3">
				<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas</label>
				<textarea name="notas" bind:value={editNotas} rows="2" class="input-field w-full resize-none"></textarea>
			</div>

			<label class="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
				<input type="checkbox" bind:checked={editActivo} />
				<input type="hidden" name="activo" value={String(editActivo)} />
				Activa
			</label>

			<div class="mt-4 flex justify-between">
				{#if esAdmin}
					<form method="POST" action="?/eliminar" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'redirect') {
								mostrarToast('Deuda eliminada')
							} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
								mostrarToast(result.data.error, 'error')
							}
						}
					}}>
						<input type="hidden" name="acreedor_id" value={acreedor.id} />
						<button
							type="submit"
							onclick={(e) => { if (!confirm('¿Eliminar esta deuda? Solo puede eliminarse si no tiene créditos ni pagos.')) e.preventDefault() }}
							class="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
							Eliminar
						</button>
					</form>
				{:else}
					<span></span>
				{/if}
				<button type="submit" class="btn-primary rounded-lg px-5 py-2 text-sm font-medium">Guardar</button>
			</div>
		</form>
	{/if}

	<!-- Créditos y Pagos lado a lado -->
	<div class="mt-6 grid gap-4 lg:grid-cols-2">
		<!-- Créditos -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
			<div class="border-b border-[var(--border)] px-5 py-3">
				<h2 class="text-sm font-medium text-[var(--text)]">Créditos ({creditos.length})</h2>
				<p class="text-[10px] text-[var(--text-dim)]">Aumentos de la deuda</p>
			</div>
			{#if creditos.length === 0}
				<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">Sin créditos registrados</div>
			{:else}
				<ul class="divide-y divide-[var(--border)]">
					{#each creditos as c (c.id)}
						{@const autor = (c as any).perfiles}
						<li class="flex items-start justify-between gap-3 px-5 py-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm text-[var(--text)]">{c.concepto}</p>
								<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
									{fmtFecha(c.fecha)}{#if autor} · {autor.nombre}{/if}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-3">
								<span class="text-sm font-semibold text-red-400">+{fmt(c.monto)}</span>
								{#if esAdmin}
									<form method="POST" action="?/eliminarCredito" use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												mostrarToast('Crédito eliminado')
												invalidateAll()
											} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
												mostrarToast(result.data.error, 'error')
											}
										}
									}}>
										<input type="hidden" name="acreedor_id" value={acreedor.id} />
										<input type="hidden" name="credito_id" value={c.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm('¿Eliminar este crédito?')) e.preventDefault() }}
											class="text-[var(--text-dim)] hover:text-red-400 transition-colors"
											title="Eliminar"
											aria-label="Eliminar crédito"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
										</button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Pagos -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
			<div class="border-b border-[var(--border)] px-5 py-3">
				<h2 class="text-sm font-medium text-[var(--text)]">Pagos ({pagos.length})</h2>
				<p class="text-[10px] text-[var(--text-dim)]">Abonos hechos que reducen la deuda</p>
			</div>
			{#if pagos.length === 0}
				<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">Sin pagos registrados</div>
			{:else}
				<ul class="divide-y divide-[var(--border)]">
					{#each pagos as p (p.id)}
						{@const autor = (p as any).perfiles}
						{@const banco = (p as any).bancos}
						<li class="flex items-start justify-between gap-3 px-5 py-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm text-[var(--text)]">{p.concepto}</p>
								<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
									{fmtFecha(p.fecha)}{#if autor} · {autor.nombre}{/if}{#if banco} · {banco.nombre}{/if}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-3">
								<span class="text-sm font-semibold text-green-400">-{fmt(p.monto)}</span>
								{#if esAdmin}
									<form method="POST" action="?/eliminarPago" use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												mostrarToast('Pago eliminado')
												invalidateAll()
											} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
												mostrarToast(result.data.error, 'error')
											}
										}
									}}>
										<input type="hidden" name="acreedor_id" value={acreedor.id} />
										<input type="hidden" name="movimiento_id" value={p.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm('¿Eliminar este pago?')) e.preventDefault() }}
											class="text-[var(--text-dim)] hover:text-red-400 transition-colors"
											title="Eliminar"
											aria-label="Eliminar pago"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
										</button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<!-- Modal agregar crédito -->
{#if agregandoCredito}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-[var(--text)]">Registrar crédito</h3>
				<button type="button" onclick={() => (agregandoCredito = false)} class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Cerrar">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<form method="POST" action="?/agregarCredito" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Crédito registrado')
						agregandoCredito = false
						invalidateAll()
					} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
						mostrarToast(result.data.error, 'error')
					}
				}
			}} class="space-y-3">
				<input type="hidden" name="acreedor_id" value={acreedor.id} />

				<div>
					<label for="credito_concepto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Concepto *</label>
					<input
						id="credito_concepto"
						name="concepto"
						type="text"
						bind:value={creditoConcepto}
						required
						placeholder="Ej: Cargo a tarjeta, préstamo de Juan..."
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="credito_monto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto *</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
						<input id="credito_monto" name="monto" type="number" bind:value={creditoMonto} min="1" required class="input-field w-full !pl-8" />
					</div>
				</div>

				<div>
					<label for="credito_fecha" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fecha</label>
					<input id="credito_fecha" name="fecha" type="date" bind:value={creditoFecha} class="input-field w-full" />
				</div>

				<div class="mt-4 flex justify-end gap-2">
					<button type="button" onclick={() => (agregandoCredito = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]">Cancelar</button>
					<button type="submit" disabled={!creditoConcepto.trim() || creditoMonto <= 0} class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40">Registrar</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal agregar pago -->
{#if agregandoPago}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-[var(--text)]">Registrar pago</h3>
				<button type="button" onclick={() => (agregandoPago = false)} class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Cerrar">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			{#if bancos.length === 0}
				<p class="text-sm text-[var(--text-muted)]">No tienes bancos o carteras activos. Crea uno primero en <a href="/bancos" class="text-[var(--brand-light)] hover:underline">Bancos</a>.</p>
			{:else}
				<form method="POST" action="?/agregarPago" use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							mostrarToast('Pago registrado')
							agregandoPago = false
							invalidateAll()
						} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
							mostrarToast(result.data.error, 'error')
						}
					}
				}} class="space-y-3">
					<input type="hidden" name="acreedor_id" value={acreedor.id} />

					<div>
						<label for="pago_banco" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Sale de *</label>
						<select id="pago_banco" name="banco_id" bind:value={pagoBancoId} required class="input-field w-full">
							{#each bancos as b}
								<option value={b.id}>{b.nombre}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="pago_monto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto *</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
							<input id="pago_monto" name="monto" type="number" bind:value={pagoMonto} min="1" required class="input-field w-full !pl-8" />
						</div>
					</div>

					<div>
						<label for="pago_concepto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Concepto</label>
						<input id="pago_concepto" name="concepto" type="text" bind:value={pagoConcepto} placeholder="Ej: Abono a tarjeta" class="input-field w-full" />
					</div>

					<div>
						<label for="pago_fecha" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fecha</label>
						<input id="pago_fecha" name="fecha" type="date" bind:value={pagoFecha} class="input-field w-full" />
					</div>

					<div class="mt-4 flex justify-end gap-2">
						<button type="button" onclick={() => (agregandoPago = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]">Cancelar</button>
						<button type="submit" disabled={!pagoBancoId || pagoMonto <= 0} class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40">Registrar</button>
					</div>
				</form>
			{/if}
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
