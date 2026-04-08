<script lang="ts">
	import { toasts } from '$lib/stores/ui'

	function toastClass(tipo: string): string {
		if (tipo === 'exito') return 'toast-exito'
		if (tipo === 'error') return 'toast-error'
		return 'toast-info'
	}
</script>

{#if $toasts.length > 0}
	<div class="fixed right-4 top-20 z-[100] flex flex-col gap-2">
		{#each $toasts as toast (toast.id)}
			<div
				class="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-md {toastClass(toast.tipo)}"
				role="alert"
			>
				{#if toast.tipo === 'exito'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
				{:else if toast.tipo === 'error'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
				{/if}
				{toast.mensaje}
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-exito {
		border-color: color-mix(in srgb, var(--success) 30%, transparent);
		background: color-mix(in srgb, var(--success) 10%, transparent);
		color: var(--success);
	}
	.toast-error {
		border-color: color-mix(in srgb, var(--danger) 30%, transparent);
		background: color-mix(in srgb, var(--danger) 10%, transparent);
		color: var(--danger);
	}
	.toast-info {
		border-color: var(--border-light);
		background: var(--bg-card);
		color: var(--text);
	}
</style>
