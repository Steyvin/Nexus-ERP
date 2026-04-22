<script lang="ts">
	import { enhance } from '$app/forms'
	import { fmt } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const bancos = $derived(data.bancos ?? [])
	const saldoTotal = $derived(bancos.filter((b: any) => b.activo).reduce((s: number, b: any) => s + Number(b.saldo ?? 0), 0))

	let creando = $state(false)
	let nuevoNombre = $state('')
	let nuevoTipo = $state<'banco' | 'cartera' | 'efectivo'>('banco')
	let nuevaCuenta = $state('')
	let nuevoSaldoInicial = $state(0)
	let nuevoColor = $state('#3b82f6')
	let nuevasNotas = $state('')
	let guardando = $state(false)

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

	function resetForm() {
		nuevoNombre = ''
		nuevoTipo = 'banco'
		nuevaCuenta = ''
		nuevoSaldoInicial = 0
		nuevoColor = '#3b82f6'
		nuevasNotas = ''
	}
</script>

<svelte:head>
	<title>Bancos — Nexus LED</title>
</svelte:head>

<div>
	<!-- Header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Bancos y Carteras</h1>
			<p class="mt-0.5 text-sm text-[var(--text-muted)]">Administra tus cuentas, efectivo y movimientos</p>
		</div>
		<button
			type="button"
			onclick={() => { creando = true; resetForm() }}
			class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Nuevo banco
		</button>
	</div>

	<!-- Total -->
	{#if bancos.length > 0}
		<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Saldo total (cuentas activas)</p>
			<p class="mt-1 text-2xl font-bold {saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'}">{fmt(saldoTotal)}</p>
		</div>
	{/if}

	<!-- Grid de bancos -->
	<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each bancos as banco (banco.id)}
			<a
				href="/bancos/{banco.id}"
				class="block rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--border-light)]"
				class:opacity-50={!banco.activo}
			>
				<div class="flex items-start justify-between gap-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style="background-color: {banco.color}20; color: {banco.color}">
							{tiposIcon[banco.tipo] ?? '🏦'}
						</div>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-[var(--text)]">{banco.nombre}</p>
							<p class="text-[10px] text-[var(--text-dim)]">{tiposLabel[banco.tipo] ?? banco.tipo}{banco.numero_cuenta ? ` · ${banco.numero_cuenta}` : ''}</p>
						</div>
					</div>
					{#if !banco.activo}
						<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">Inactivo</span>
					{/if}
				</div>

				<div class="mt-4">
					<p class="text-[10px] text-[var(--text-dim)]">Saldo actual</p>
					<p class="mt-0.5 text-xl font-semibold {Number(banco.saldo) >= 0 ? 'text-[var(--text)]' : 'text-red-400'}">
						{fmt(banco.saldo)}
					</p>
				</div>

				{#if banco.saldo_inicial > 0 || banco.total_movimientos !== 0}
					<div class="mt-3 flex justify-between text-[10px] text-[var(--text-dim)]">
						<span>Inicial: {fmt(banco.saldo_inicial)}</span>
						<span class={Number(banco.total_movimientos) >= 0 ? 'text-green-400' : 'text-red-400'}>
							{Number(banco.total_movimientos) >= 0 ? '+' : ''}{fmt(banco.total_movimientos)}
						</span>
					</div>
				{/if}
			</a>
		{/each}
	</div>

	{#if bancos.length === 0}
		<div class="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
			<p class="text-sm text-[var(--text-muted)]">Aún no has creado ningún banco o cartera</p>
			<button
				type="button"
				onclick={() => { creando = true; resetForm() }}
				class="mt-3 text-sm text-[var(--brand-light)] hover:underline"
			>
				Crear el primero
			</button>
		</div>
	{/if}
</div>

<!-- Modal crear -->
{#if creando}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-[var(--text)]">Nuevo banco / cartera</h3>
				<button
					type="button"
					onclick={() => (creando = false)}
					class="text-[var(--text-dim)] hover:text-[var(--text)]"
					aria-label="Cerrar"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<form method="POST" action="?/crear" use:enhance={() => {
				guardando = true
				return async ({ result, update }) => {
					guardando = false
					if (result.type === 'redirect') {
						mostrarToast('Banco creado')
						creando = false
					} else if (result.type === 'failure' && result.data && typeof result.data.error === 'string') {
						mostrarToast(result.data.error, 'error')
					}
					await update()
				}
			}} class="space-y-3">
				<div>
					<label for="nombre" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre *</label>
					<input
						id="nombre"
						name="nombre"
						type="text"
						bind:value={nuevoNombre}
						required
						placeholder="Ej: Bancolombia, Nequi, Caja..."
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="tipo" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo</label>
					<select id="tipo" name="tipo" bind:value={nuevoTipo} class="input-field w-full">
						<option value="banco">🏦 Banco</option>
						<option value="cartera">💳 Cartera (Nequi, Daviplata, etc.)</option>
						<option value="efectivo">💵 Efectivo</option>
					</select>
				</div>

				<div>
					<label for="cuenta" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Número de cuenta (opcional)</label>
					<input
						id="cuenta"
						name="numero_cuenta"
						type="text"
						bind:value={nuevaCuenta}
						placeholder="****1234"
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="saldo" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Saldo inicial</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)]">$</span>
						<input
							id="saldo"
							name="saldo_inicial"
							type="number"
							bind:value={nuevoSaldoInicial}
							class="input-field w-full !pl-8"
						/>
					</div>
				</div>

				<div>
					<label for="color" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Color</label>
					<div class="flex items-center gap-2">
						<input id="color" name="color" type="color" bind:value={nuevoColor} class="h-9 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent" />
						<span class="text-xs text-[var(--text-dim)]">{nuevoColor}</span>
					</div>
				</div>

				<div>
					<label for="notas" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notas (opcional)</label>
					<textarea id="notas" name="notas" bind:value={nuevasNotas} rows="2" class="input-field w-full resize-none"></textarea>
				</div>

				<div class="mt-4 flex justify-end gap-2">
					<button type="button" onclick={() => (creando = false)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]"
					>Cancelar</button>
					<button type="submit" disabled={guardando || !nuevoNombre.trim()} class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40">
						{guardando ? 'Creando...' : 'Crear'}
					</button>
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

	.input-field {
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
		width: 100%;
	}
	.input-field:focus {
		border-color: var(--brand);
	}
</style>
