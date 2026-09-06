<script lang="ts">
	import { fmt } from '$lib/utils/format'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const clientesConDeuda = $derived(data.clientesConDeuda ?? [])
	const proveedoresConDeuda = $derived(data.proveedoresConDeuda ?? [])
	const deudasPersonalesConDeuda = $derived(data.deudasPersonalesConDeuda ?? [])

	const tipoLabel: Record<string, string> = {
		personal: 'Personal',
		negocio: 'Del negocio'
	}
</script>

<svelte:head>
	<title>Financiera — Nexus LED</title>
</svelte:head>

<div>
	<!-- Cabecera -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Financiera</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Cuentas por cobrar y por pagar</p>
		</div>
		<div class="flex gap-2">
			<a
				href="/financiera/proveedores"
				class="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
			>Proveedores</a>
			<a
				href="/financiera/deudas-personales"
				class="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				Deudas personales
			</a>
		</div>
	</div>

	<!-- Resumen -->
	<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Total por cobrar (clientes)</p>
			<p class="mt-1 text-2xl font-bold text-red-400">{fmt(data.totalPorCobrar)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">{clientesConDeuda.length} cliente{clientesConDeuda.length === 1 ? '' : 's'} con saldo pendiente</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Total por pagar (proveedores)</p>
			<p class="mt-1 text-2xl font-bold text-orange-400">{fmt(data.totalPorPagar)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">{proveedoresConDeuda.length} proveedor{proveedoresConDeuda.length === 1 ? '' : 'es'} con deuda pendiente</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Debo yo (personal)</p>
			<p class="mt-1 text-2xl font-bold text-blue-400">{fmt(data.totalDeudaPersonal)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">Deudas personales pendientes</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Debe el negocio</p>
			<p class="mt-1 text-2xl font-bold text-purple-400">{fmt(data.totalDeudaNegocio)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">Deudas del negocio pendientes</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<p class="text-xs text-[var(--text-muted)]">Dinero disponible</p>
			<p class="mt-1 text-2xl font-bold text-green-400">{fmt(data.totalDisponible)}</p>
			<p class="mt-1 text-[10px] text-[var(--text-dim)]">Suma de bancos, carteras y efectivo</p>
		</div>
	</div>

	<!-- Listas lado a lado -->
	<div class="mt-6 grid gap-4 lg:grid-cols-2">
		<!-- Clientes con deuda -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
			<div class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
				<h2 class="text-sm font-medium text-[var(--text)]">Clientes que nos deben</h2>
				<a href="/clientes" class="text-xs text-[var(--brand-light)] hover:underline">Ver todos</a>
			</div>
			{#if clientesConDeuda.length === 0}
				<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">Ningún cliente tiene deuda pendiente</div>
			{:else}
				<ul class="divide-y divide-[var(--border)]">
					{#each clientesConDeuda as c (c.id)}
						<li>
							<a href="/clientes" class="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-[var(--text)]">{c.nombre}</p>
									{#if c.contacto}
										<p class="text-[10px] text-[var(--text-dim)]">{c.contacto}</p>
									{/if}
								</div>
								<span class="shrink-0 text-sm font-semibold text-red-400">{fmt(c.deuda)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Proveedores con deuda -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
			<div class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
				<h2 class="text-sm font-medium text-[var(--text)]">Proveedores a los que les debemos</h2>
				<a href="/financiera/proveedores" class="text-xs text-[var(--brand-light)] hover:underline">Ver todos</a>
			</div>
			{#if proveedoresConDeuda.length === 0}
				<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">No le debes dinero a ningún proveedor</div>
			{:else}
				<ul class="divide-y divide-[var(--border)]">
					{#each proveedoresConDeuda as p (p.id)}
						<li>
							<a href="/financiera/proveedores/{p.id}" class="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-[var(--text)]">{p.nombre}</p>
									{#if p.contacto}
										<p class="text-[10px] text-[var(--text-dim)]">{p.contacto}</p>
									{/if}
								</div>
								<span class="shrink-0 text-sm font-semibold text-orange-400">{fmt(p.deuda)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Deudas personales -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden lg:col-span-2">
			<div class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
				<h2 class="text-sm font-medium text-[var(--text)]">Deudas personales y del negocio</h2>
				<a href="/financiera/deudas-personales" class="text-xs text-[var(--brand-light)] hover:underline">Ver todas</a>
			</div>
			{#if deudasPersonalesConDeuda.length === 0}
				<div class="px-5 py-10 text-center text-sm text-[var(--text-dim)]">No hay deudas personales pendientes</div>
			{:else}
				<ul class="divide-y divide-[var(--border)]">
					{#each deudasPersonalesConDeuda as d (d.id)}
						<li>
							<a href="/financiera/deudas-personales/{d.id}" class="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
								<div class="min-w-0 flex items-center gap-2">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {d.tipo === 'personal' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}">
										{tipoLabel[d.tipo] ?? d.tipo}
									</span>
									<p class="truncate text-sm font-medium text-[var(--text)]">{d.nombre}</p>
								</div>
								<span class="shrink-0 text-sm font-semibold {d.tipo === 'personal' ? 'text-blue-400' : 'text-purple-400'}">{fmt(d.deuda)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.btn-primary {
		background: var(--brand);
		color: #080808;
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
</style>
