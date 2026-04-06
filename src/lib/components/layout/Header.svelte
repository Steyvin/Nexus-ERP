<script lang="ts">
	import { usuario } from '$lib/stores/auth'
	import { sidebarAbierta } from '$lib/stores/ui'
	import { cerrarSesion } from '$lib/utils/auth'
	import { ROL_LABEL } from '$lib/types'

	let cerrando = $state(false)

	async function handleLogout() {
		cerrando = true
		await cerrarSesion()
		cerrando = false
	}
</script>

<header class="header sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[var(--border)] px-4 backdrop-blur-md lg:pl-[276px]">
	<!-- Botón hamburguesa mobile -->
	<button
		class="hamburger flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-[var(--text)] lg:hidden"
		onclick={() => sidebarAbierta.update((v) => !v)}
		aria-label="Abrir menú"
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<line x1="3" y1="6" x2="21" y2="6"/>
			<line x1="3" y1="12" x2="21" y2="12"/>
			<line x1="3" y1="18" x2="21" y2="18"/>
		</svg>
	</button>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Info usuario + logout -->
	{#if $usuario}
		<div class="flex items-center gap-3">
			<div class="hidden items-center gap-2 sm:flex">
				<span class="text-sm text-[var(--text)]">{$usuario.nombre}</span>
				<span class="rounded bg-[var(--border-light)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
					{ROL_LABEL[$usuario.rol] ?? $usuario.rol}
				</span>
			</div>
			<button
				onclick={handleLogout}
				disabled={cerrando}
				class="flex h-8 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)] disabled:opacity-50"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
					<polyline points="16 17 21 12 16 7"/>
					<line x1="21" y1="12" x2="9" y2="12"/>
				</svg>
				{cerrando ? 'Saliendo...' : 'Salir'}
			</button>
		</div>
	{/if}
</header>

<style>
	.header {
		background: color-mix(in srgb, var(--bg) 80%, transparent);
	}
	.hamburger:hover {
		background: rgba(255, 255, 255, 0.06);
	}
</style>
