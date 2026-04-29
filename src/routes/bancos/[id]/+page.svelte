<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation'
	import { enhance } from '$app/forms'
	import { fmt, fmtFecha } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const banco = $derived(data.banco)
	const movimientos = $derived(data.movimientos ?? [])
	const esAdmin = $derived(data.rol === 'admin')

	const tiposLabel: Record<string, string> = {
		banco: 'Banco',
		cartera: 'Cartera',
		efectivo: 'Efectivo'
	}

	const tiposIcon: Record<string, string> = {
		banco: '🏦',
		cartera: '💳',
		efectivo: '💵'
	}

	const tiposMov: Record<string, { label: string; color: string; signo: '+' | '-' | '=' }> = {
		ingreso: { label: 'Ingreso', color: 'text-green-400', signo: '+' },
		abono: { label: 'Abono', color: 'text-green-400', signo: '+' },
		gasto: { label: 'Gasto', color: 'text-red-400', signo: '-' },
		compra: { label: 'Compra', color: 'text-red-400', signo: '-' },
		pago: { label: 'Pago', color: 'text-red-400', signo: '-' },
		ajuste: { label: 'Ajuste', color: 'text-yellow-400', signo: '=' },
		transferencia: { label: 'Transferencia', color: 'text-blue-400', signo: '=' }
	}

	// Form agregar movimiento
	let agregando = $state(false)
	let movTipo = $state<'ingreso' | 'gasto' | 'compra' | 'pago' | 'ajuste'>('gasto')
	let movConcepto = $state('')
	let movMonto = $state(0)
	let movFecha = $state(new Date().toISOString().slice(0, 10))

	// Edición
	let editando = $state(false)
	let editNombre = $state('')
	let editTipo = $state<'banco' | 'cartera' | 'efectivo'>('banco')
	let editCuenta = $state('')
	let editColor = $state('#3b82f6')
	let editNotas = $state('')
	let editActivo = $state(true)

	// Filtro
	let filtro = $state(data.filtroTipo ?? 'todos')

	$effect(() => {
		if (!editando) {
			editNombre = banco.nombre
			editTipo = banco.tipo
			editCuenta = banco.numero_cuenta ?? ''
			editColor = banco.color
			editNotas = banco.notas ?? ''
			editActivo = banco.activo
		}
	})

	function cambiarFiltro(nuevo: string) {
		filtro = nuevo
		const url = new URL(window.location.href)
		if (nuevo === 'todos') url.searchParams.delete('tipo')
		else url.searchParams.set('tipo', nuevo)
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true })
	}

	// Agregar totales por tipo para el período mostrado
	const totales = $derived.by(() => {
		const t: Record<string, { count: number; monto: number }> = {
			ingreso: { count: 0, monto: 0 },
			abono: { count: 0, monto: 0 },
			gasto: { count: 0, monto: 0 },
			compra: { count: 0, monto: 0 },
			pago: { count: 0, monto: 0 },
			ajuste: { count: 0, monto: 0 },
			transferencia: { count: 0, monto: 0 }
		}
		for (const m of movimientos) {
			const bucket = t[m.tipo]
			if (bucket) {
				bucket.count++
				bucket.monto += Number(m.monto ?? 0)
			}
		}
		return t
	})

	const totalEntradas = $derived(totales.ingreso.monto + totales.abono.monto)
	const totalSalidas = $derived(totales.gasto.monto + totales.compra.monto + totales.pago.monto)
</script>

<svelte:head>
	<title>{banco.nombre} — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex items-center gap-3">
			<a href="/bancos" class="text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="Volver">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</a>
			<div class="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style="background-color: {banco.color}25; color: {banco.color}">
				{tiposIcon[banco.tipo] ?? '🏦'}
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-xl font-semibold text-[var(--text)]">{banco.nombre}</h1>
					{#if !banco.activo}
						<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">Inactivo</span>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-[var(--text-dim)]">
					{tiposLabel[banco.tipo] ?? banco.tipo}{banco.numero_cuenta ? ` · ${banco.numero_cuenta}` : ''}
				</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => (editando = !editando)}
				class="btn-secondary rounded-lg px-3 py-1.5 text-sm"
			>{editando ? 'Cancelar' : 'Editar'}</button>
			<button
				type="button"
				onclick={() => { agregando = true; movConcepto = ''; movMonto = 0; movTipo = 'gasto'; movFecha = new Date().toISOString().slice(0,10) }}
				class="btn-primary flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				Movimiento
			</button>
		</div>
	</div>

	<!-- Resumen saldo y movimientos -->
	<div class="mt-5 grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Saldo actual</p>
			<p class="mt-1 text-2xl font-bold {Number(banco.saldo) >= 0 ? 'text-[var(--text)]' : 'text-red-400'}">
				{fmt(banco.saldo)}
			</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">Inicial: {fmt(banco.saldo_inicial)}</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Entradas (ingresos + abonos)</p>
			<p class="mt-1 text-2xl font-semibold text-green-400">+{fmt(totalEntradas)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">
				{totales.ingreso.count} ingreso{totales.ingreso.count === 1 ? '' : 's'}, {totales.abono.count} abono{totales.abono.count === 1 ? '' : 's'}
			</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Salidas (gastos + compras + pagos)</p>
			<p class="mt-1 text-2xl font-semibold text-red-400">-{fmt(totalSalidas)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">
				{totales.gasto.count + totales.compra.count + totales.pago.count} registrado{(totales.gasto.count + totales.compra.count + totales.pago.count) === 1 ? '' : 's'}
			</p>
		</div>
	</div>

	<!-- Formulario edición -->
	{#if editando}
		<form method="POST" action="?/actualizar" use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					mostrarToast('Banco actualizado')
					editando = false
					invalidateAll()
				} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
					mostrarToast(result.data.error, 'error')
				}
			}
		}} class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<input type="hidden" name="banco_id" value={banco.id} />

			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre *</label>
					<input name="nombre" type="text" bind:value={editNombre} required class="input-field w-full" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo</label>
					<select name="tipo" bind:value={editTipo} class="input-field w-full">
						<option value="banco">🏦 Banco</option>
						<option value="cartera">💳 Cartera</option>
						<option value="efectivo">💵 Efectivo</option>
					</select>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Número de cuenta</label>
					<input name="numero_cuenta" type="text" bind:value={editCuenta} class="input-field w-full" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Color</label>
					<input name="color" type="color" bind:value={editColor} class="h-9 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent" />
				</div>
			</div>

			<div class="mt-3">
				<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas</label>
				<textarea name="notas" bind:value={editNotas} rows="2" class="input-field w-full resize-none"></textarea>
			</div>

			<label class="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
				<input type="checkbox" bind:checked={editActivo} />
				<input type="hidden" name="activo" value={String(editActivo)} />
				Cuenta activa
			</label>

			<div class="mt-4 flex justify-between">
				{#if esAdmin}
					<form method="POST" action="?/eliminar" use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'redirect') {
								mostrarToast('Banco eliminado')
							} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
								mostrarToast(result.data.error, 'error')
							}
						}
					}}>
						<input type="hidden" name="banco_id" value={banco.id} />
						<button
							type="submit"
							onclick={(e) => { if (!confirm('¿Eliminar este banco? Solo puede eliminarse si no tiene movimientos.')) e.preventDefault() }}
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

	<!-- Filtro y movimientos -->
	<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
			<h2 class="text-sm font-medium text-[var(--text)]">Movimientos ({movimientos.length})</h2>
			<div class="flex flex-wrap gap-1">
				{#each [
					{ v: 'todos', l: 'Todos' },
					{ v: 'ingreso', l: 'Ingresos' },
					{ v: 'abono', l: 'Abonos' },
					{ v: 'gasto', l: 'Gastos' },
					{ v: 'compra', l: 'Compras' },
					{ v: 'pago', l: 'Pagos' }
				] as opc}
					<button
						type="button"
						onclick={() => cambiarFiltro(opc.v)}
						class="rounded-lg border px-2.5 py-1 text-[11px] transition-colors {filtro === opc.v ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-light)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text)]'}"
					>
						{opc.l}
					</button>
				{/each}
			</div>
		</div>

		{#if movimientos.length === 0}
			<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">Sin movimientos</div>
		{:else}
			<ul class="divide-y divide-[var(--border)]">
				{#each movimientos as m (m.id)}
					{@const info = tiposMov[m.tipo] ?? { label: m.tipo, color: 'text-[var(--text)]', signo: '=' }}
					{@const autor = (m as any).perfiles}
					{@const ped = (m as any).pedidos}
					<li class="flex items-start justify-between gap-3 px-5 py-3">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
									{info.label}
								</span>
								<span class="text-sm text-[var(--text)]">{m.concepto}</span>
							</div>
							<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
								{fmtFecha(m.fecha)}{#if autor} · {autor.nombre}{/if}
								{#if ped}
									· <a href="/pedidos/{ped.id}" class="text-[var(--brand-light)] hover:underline">Pedido de {ped.clientes?.nombre ?? 'cliente'}</a>
								{/if}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-3">
							<span class="text-sm font-semibold {info.color}">
								{info.signo === '-' ? '-' : info.signo === '+' ? '+' : ''}{fmt(m.monto)}
							</span>
							{#if esAdmin && !m.pedido_id}
								<form method="POST" action="?/eliminarMovimiento" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											mostrarToast('Movimiento eliminado')
											invalidateAll()
										} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
											mostrarToast(result.data.error, 'error')
										}
									}
								}}>
									<input type="hidden" name="banco_id" value={banco.id} />
									<input type="hidden" name="movimiento_id" value={m.id} />
									<button
										type="submit"
										onclick={(e) => { if (!confirm('¿Eliminar este movimiento?')) e.preventDefault() }}
										class="text-[var(--text-dim)] hover:text-red-400 transition-colors"
										title="Eliminar"
										aria-label="Eliminar movimiento"
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

<!-- Modal agregar movimiento -->
{#if agregando}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-[var(--text)]">Registrar movimiento</h3>
				<button
					type="button"
					onclick={() => (agregando = false)}
					class="text-[var(--text-dim)] hover:text-[var(--text)]"
					aria-label="Cerrar"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<form method="POST" action="?/agregarMovimiento" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Movimiento registrado')
						agregando = false
						invalidateAll()
					} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
						mostrarToast(result.data.error, 'error')
					}
				}
			}} class="space-y-3">
				<input type="hidden" name="banco_id" value={banco.id} />

				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo *</label>
					<div class="grid grid-cols-3 gap-2">
						{#each [
							{ v: 'ingreso', l: 'Ingreso', c: 'green' },
							{ v: 'gasto', l: 'Gasto', c: 'red' },
							{ v: 'compra', l: 'Compra', c: 'red' },
							{ v: 'pago', l: 'Pago', c: 'red' },
							{ v: 'ajuste', l: 'Ajuste', c: 'yellow' }
						] as tp}
							<button
								type="button"
								onclick={() => (movTipo = tp.v as any)}
								class="rounded-lg border px-2 py-1.5 text-xs transition-colors {movTipo === tp.v ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-light)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)]'}"
							>
								{tp.l}
							</button>
						{/each}
					</div>
					<input type="hidden" name="tipo" value={movTipo} />
				</div>

				<div>
					<label for="concepto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Concepto *</label>
					<input
						id="concepto"
						name="concepto"
						type="text"
						bind:value={movConcepto}
						required
						placeholder={movTipo === 'ingreso' ? 'Ej: Venta directa, préstamo...' : movTipo === 'compra' ? 'Ej: LED, acrílico, materiales...' : movTipo === 'pago' ? 'Ej: Pago a proveedor X' : movTipo === 'gasto' ? 'Ej: Servicios, transporte...' : 'Concepto del movimiento'}
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="monto" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto *</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
						<input
							id="monto"
							name="monto"
							type="number"
							bind:value={movMonto}
							min="1"
							required
							class="input-field w-full !pl-8"
						/>
					</div>
				</div>

				<div>
					<label for="fecha" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fecha</label>
					<input
						id="fecha"
						name="fecha"
						type="date"
						bind:value={movFecha}
						class="input-field w-full"
					/>
				</div>

				<div class="mt-4 flex justify-end gap-2">
					<button type="button" onclick={() => (agregando = false)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button
						type="submit"
						disabled={!movConcepto.trim() || movMonto <= 0}
						class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40"
					>Registrar</button>
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
