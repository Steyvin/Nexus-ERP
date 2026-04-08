<script lang="ts">
	import { TODOS_COLORES } from '$lib/utils/calculadoras';
	
	let { value = $bindable() } = $props<{ value: string }>();
	
	let open = $state(false);
	
	const COLOR_HEX: Record<string, string> = {
		'Rojo': '#ef4444',
		'Verde': '#22c55e',
		'Negro': '#222222',
		'Blanco': '#ffffff',
		'Rosado': '#f472b6',
		'Amarillo': '#eab308',
		'Naranja': '#f97316',
		'Morado': '#a855f7',
		'Azul': '#3b82f6',
		'Aguamarina': '#2dd4bf',
		'Dorado': '#fbbf24', 
		'Plateado': '#94a3b8',
		'Oro Rosa': '#e2b3b7'
	};

	function selectColor(c: string) {
		value = c;
		open = false;
	}
	
	function onClickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (open && node && !node.contains(event.target as Node) && !event.defaultPrevented) {
				open = false;
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}
</script>

<div class="relative flex-1" use:onClickOutside>
	<button 
		type="button"
		onclick={() => open = !open}
		class="w-full flex items-center justify-between rounded-lg bg-[#121212] border border-[#2a2a2a] px-3 py-2 text-[13px] text-white hover:border-[#444] transition-colors"
	>
		<div class="flex items-center gap-2">
			<span class="w-3 h-3 rounded-full shadow-sm flex-shrink-0" style="background: {COLOR_HEX[value] || '#fff'}; border: 1px solid rgba(255,255,255,0.15);"></span>
			{value}
		</div>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--text-dim)] shrink-0"><polyline points="6 9 12 15 18 9"/></svg>
	</button>
	
	{#if open}
		<div class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[#1a1a1a] shadow-xl py-1 custom-scrollbar">
			{#each TODOS_COLORES as color}
				<button 
					type="button"
					onclick={() => selectColor(color)}
					class="w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.05)] {value === color ? 'bg-[rgba(255,255,255,0.05)] text-white font-medium' : 'text-[#a0a0a0]'}"
				>
					<span class="w-3 h-3 rounded-full flex-shrink-0" style="background: {COLOR_HEX[color]}; border: 1px solid rgba(255,255,255,0.15);"></span>
					{color}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #333;
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>
