<script lang="ts">
	import { page } from '$app/stores'
	import { usuario, esAdmin, esFabricador, esDiseñador, esFinanzas } from '$lib/stores/auth'
	import { sidebarAbierta } from '$lib/stores/ui'
	import logoNexus from '$lib/assets/NEXUS.png'

	// Cerrar sidebar mobile al navegar
	$effect(() => {
		$page.url.pathname
		sidebarAbierta.set(false)
	})

	interface NavItem {
		href: string
		label: string
		icon: string
	}

	// Navegación según rol
	const navAdmin: NavItem[] = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'grid' },
		{ href: '/pedidos', label: 'Pedidos', icon: 'package' },
		{ href: '/cotizaciones', label: 'Cotizaciones', icon: 'file-text' },
		{ href: '/clientes', label: 'Clientes', icon: 'users' },
		{ href: '/reportes', label: 'Reportes', icon: 'bar-chart' }
	]

	const navConfig: NavItem[] = [
		{ href: '/configuracion/catalogo', label: 'Catálogo', icon: 'layers' },
		{ href: '/configuracion/usuarios', label: 'Usuarios', icon: 'shield' }
	]

	let navItems = $derived.by(() => {
		if ($esAdmin) return navAdmin
		if ($esFabricador)
			return [
				{ href: '/dashboard', label: 'Dashboard', icon: 'grid' },
				{ href: '/pedidos', label: 'Pedidos', icon: 'package' }
			]
		if ($esDiseñador)
			return [
				{ href: '/dashboard', label: 'Dashboard', icon: 'grid' },
				{ href: '/pedidos', label: 'Mis Pedidos', icon: 'package' }
			]
		if ($esFinanzas)
			return [
				{ href: '/dashboard', label: 'Dashboard', icon: 'grid' },
				{ href: '/pedidos', label: 'Pedidos', icon: 'package' },
				{ href: '/cotizaciones', label: 'Cotizaciones', icon: 'file-text' },
				{ href: '/clientes', label: 'Clientes', icon: 'users' },
				{ href: '/reportes', label: 'Reportes', icon: 'bar-chart' }
			]
		return [{ href: '/dashboard', label: 'Dashboard', icon: 'grid' }]
	})

	let showConfig = $derived($esAdmin)

	function isActive(href: string): boolean {
		if (href === '/dashboard') return ($page.url.pathname as string) === '/dashboard'
		return $page.url.pathname.startsWith(href)
	}

	function linkClass(href: string): string {
		const base = 'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors'
		if (isActive(href)) return `${base} nav-link-active`
		return `${base} nav-link-idle`
	}
</script>

<!-- Overlay mobile -->
{#if $sidebarAbierta}
	<button
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
		onclick={() => sidebarAbierta.set(false)}
		aria-label="Cerrar menú"
	></button>
{/if}

<!-- Sidebar -->
<aside
	class="sidebar fixed top-0 left-0 z-50 flex h-dvh w-[260px] flex-col border-r border-[var(--border)] bg-[var(--bg-card)] transition-transform duration-200 lg:translate-x-0"
	class:open={$sidebarAbierta}
>
	<!-- Logo -->
	<div class="flex h-14 items-center gap-3 border-b border-[var(--border)] px-5">
		<img src={logoNexus} alt="Nexus LED" class="h-6" />
		<span
			class="ml-auto rounded bg-[var(--brand-dark)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-light)]"
			>ERP</span
		>
	</div>

	<!-- Nav principal -->
	<nav class="flex-1 overflow-y-auto px-3 py-4">
		<ul class="space-y-0.5">
			{#each navItems as item}
				<li>
					<a href={item.href} class={linkClass(item.href)}>
						<span class="flex h-5 w-5 items-center justify-center">
							{#if item.icon === 'grid'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><rect x="3" y="3" width="7" height="7" /><rect
										x="14"
										y="3"
										width="7"
										height="7"
									/><rect x="14" y="14" width="7" height="7" /><rect
										x="3"
										y="14"
										width="7"
										height="7"
									/></svg
								>
							{:else if item.icon === 'package'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path d="M16.5 9.4l-9-5.19" /><path
										d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
									/><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line
										x1="12"
										y1="22.08"
										x2="12"
										y2="12"
									/></svg
								>
							{:else if item.icon === 'file-text'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path
										d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
									/><polyline points="14 2 14 8 20 8" /><line
										x1="16"
										y1="13"
										x2="8"
										y2="13"
									/><line x1="16" y1="17" x2="8" y2="17" /><polyline
										points="10 9 9 9 8 9"
									/></svg
								>
							{:else if item.icon === 'users'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle
										cx="9"
										cy="7"
										r="4"
									/><path d="M23 21v-2a4 4 0 00-3-3.87" /><path
										d="M16 3.13a4 4 0 010 7.75"
									/></svg
								>
							{:else if item.icon === 'bar-chart'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><line x1="12" y1="20" x2="12" y2="10" /><line
										x1="18"
										y1="20"
										x2="18"
										y2="4"
									/><line x1="6" y1="20" x2="6" y2="16" /></svg
								>
							{/if}
						</span>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>

		<!-- Configuración (solo admin) -->
		{#if showConfig}
			<div class="mt-6 mb-2 px-3">
				<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]"
					>Configuración</span
				>
			</div>
			<ul class="space-y-0.5">
				{#each navConfig as item}
					<li>
						<a href={item.href} class={linkClass(item.href)}>
							<span class="flex h-5 w-5 items-center justify-center">
								{#if item.icon === 'layers'}
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline
											points="2 17 12 22 22 17"
										/><polyline points="2 12 12 17 22 12" /></svg
									>
								{:else if item.icon === 'shield'}
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path
											d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
										/></svg
									>
								{/if}
							</span>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<!-- Usuario en la parte inferior -->
	<div class="border-t border-[var(--border)] px-4 py-3">
		{#if $usuario}
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border-light)] text-xs font-medium text-[var(--text-muted)]"
				>
					{$usuario.nombre?.charAt(0)?.toUpperCase() ?? '?'}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-[var(--text)]">{$usuario.nombre}</p>
					<p class="text-[11px] text-[var(--text-dim)]">{$usuario.rol}</p>
				</div>
			</div>
		{/if}
	</div>
</aside>

<style>
	/* Sidebar mobile hidden by default, shown when open */
	@media (max-width: 1023px) {
		.sidebar {
			transform: translateX(-100%);
		}
		.sidebar.open {
			transform: translateX(0);
		}
	}

	/* Nav link states via CSS classes to avoid Svelte class: directive issues with / */
	:global(.nav-link-active) {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text);
	}
	:global(.nav-link-idle) {
		color: var(--text-muted);
	}
	:global(.nav-link-idle:hover) {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
	}
</style>
