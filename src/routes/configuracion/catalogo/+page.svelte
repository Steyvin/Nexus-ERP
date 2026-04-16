<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { mostrarToast } from '$lib/stores/ui';
	import { fmt } from '$lib/utils/format';
	import { TIPO_LABEL } from '$lib/types';
	import type { TipoProducto, CatalogoParametros } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Estado de edición
	let abierto = $state<string | null>(null);
	let guardando = $state<string | null>(null);
	let editando = $state<Record<string, Record<string, unknown>>>({});

	// Inicializar datos editables
	$effect(() => {
		const e: Record<string, Record<string, unknown>> = {};
		for (const item of data.catalogo) {
			e[item.id] = structuredClone(item.parametros as Record<string, unknown>);
		}
		editando = e;
	});

	function toggleAbierto(id: string) {
		abierto = abierto === id ? null : id;
	}

	async function guardar(item: CatalogoParametros) {
		guardando = item.id;
		const { error } = await supabase
			.from('catalogo_parametros')
			.update({ parametros: editando[item.id] })
			.eq('id', item.id);
		guardando = null;
		if (error) return mostrarToast('Error al guardar: ' + error.message, 'error');
		mostrarToast(`${item.nombre} actualizado`);
	}

	// Labels descriptivos para cada clave de parámetro
	const PARAM_INFO: Record<string, { label: string; sufijo?: string }> = {
		// Nube
		precio_cm2_acrilico: { label: 'Precio acrílico', sufijo: '$/cm²' },
		precio_cm2_acrilico_premium: { label: 'Precio acrílico premium', sufijo: '$/cm²' },
		precio_faja_cm2: { label: 'Precio faja', sufijo: '$/cm²' },
		separacion_led_cm: { label: 'Separación LED', sufijo: 'cm' },
		precio_led_m: { label: 'Precio LED', sufijo: '$/metro' },
		precio_vinilo_m2: { label: 'Vinilo', sufijo: '$/m²' },
		estructura_pequena: { label: 'Estructura pequeña (≤100cm)', sufijo: '$' },
		estructura_mediana: { label: 'Estructura mediana (≤140cm)', sufijo: '$' },
		estructura_grande: { label: 'Estructura grande (>140cm)', sufijo: '$' },
		transporte_pequeno: { label: 'Transporte pequeño (≤80cm)', sufijo: '$' },
		transporte_grande: { label: 'Transporte grande (>80cm)', sufijo: '$' },
		mdo_pequena: { label: 'Mano de obra pequeña (≤80cm)', sufijo: '$' },
		mdo_mediana: { label: 'Mano de obra mediana (≤120cm)', sufijo: '$' },
		mdo_grande: { label: 'Mano de obra grande (>120cm)', sufijo: '$' },
		margen_ganancia: { label: 'Margen de ganancia', sufijo: '%' },
		// Letra
		mdo_por_letra: { label: 'MdO por letra', sufijo: '$' },
		// Acrílico
		precio_led_m_perimetro: { label: 'LED perímetro', sufijo: '$/metro' },
		precio_apliques: { label: 'Apliques', sufijo: '$' },
		precio_cm2_microporosa: { label: 'Precio microporosa', sufijo: '$/cm²' },
		// Vinilo
		precio_m2: { label: 'Precio', sufijo: '$/m²' },
		instalacion: { label: 'Instalación', sufijo: '$' },
		gratis_desde_m2: { label: 'Gratis desde', sufijo: 'm²' },
		// Circular
		d40: { label: 'Diámetro 40 cm', sufijo: '$' },
		d50: { label: 'Diámetro 50 cm', sufijo: '$' },
		d60: { label: 'Diámetro 60 cm', sufijo: '$' },
		d70: { label: 'Diámetro 70 cm', sufijo: '$' },
		d80: { label: 'Diámetro 80 cm', sufijo: '$' }
	};

	function esObjetoAnidado(val: unknown): val is Record<string, unknown> {
		return typeof val === 'object' && val !== null && !Array.isArray(val);
	}

	function getLabel(key: string): string {
		return PARAM_INFO[key]?.label ?? key;
	}

	function getSufijo(key: string): string {
		return PARAM_INFO[key]?.sufijo ?? '';
	}
</script>

<svelte:head>
	<title>Catálogo — Nexus LED</title>
</svelte:head>

<div>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Catálogo de productos</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				Configura los parámetros de precios de cada producto
			</p>
		</div>
	</div>

	<div class="mt-6 space-y-3">
		{#each data.catalogo as item (item.id)}
			{@const isOpen = abierto === item.id}
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] transition-colors">
				<!-- Header -->
				<button
					onclick={() => toggleAbierto(item.id)}
					class="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
				>
					<div class="flex items-center gap-3">
						<span
							class="flex h-8 w-8 items-center justify-center rounded-lg {item.activo
								? 'bg-green-500/15 text-green-400'
								: 'bg-red-500/15 text-red-400'}"
						>
							<svg
								width="14"
								height="14"
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
						</span>
						<div>
							<span class="text-sm font-medium text-[var(--text)]">{item.nombre}</span>
							<span class="ml-2 text-[10px] text-[var(--text-dim)]"
								>{TIPO_LABEL[item.tipo as TipoProducto] ?? item.tipo}</span
							>
						</div>
					</div>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-[var(--text-dim)] transition-transform {isOpen ? 'rotate-180' : ''}"
						><polyline points="6 9 12 15 18 9" /></svg
					>
				</button>

				<!-- Contenido expandible -->
				{#if isOpen && editando[item.id]}
					<div class="border-t border-[var(--border)] px-5 py-4">
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each Object.entries(editando[item.id]) as [key, valor]}
								{#if esObjetoAnidado(valor)}
									<!-- Objeto anidado (ej: neon tiers) -->
									<div class="col-span-full rounded-lg border border-[var(--border)] p-3">
										<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">
											{getLabel(key) || key}
										</p>
										<div class="grid gap-2 sm:grid-cols-3">
											{#each Object.entries(valor) as [subKey, subVal]}
												<div>
													<label class="mb-1 block text-[10px] text-[var(--text-dim)]"
														>{subKey}</label
													>
													{#if typeof subVal === 'number'}
														<input
															type="number"
															value={subVal}
															oninput={(e) => {
																const target = e.currentTarget as HTMLInputElement;
																(editando[item.id][key] as Record<string, unknown>)[subKey] =
																	Number(target.value);
															}}
															class="param-input"
														/>
													{:else}
														<input
															type="text"
															value={String(subVal)}
															oninput={(e) => {
																const target = e.currentTarget as HTMLInputElement;
																(editando[item.id][key] as Record<string, unknown>)[subKey] =
																	target.value;
															}}
															class="param-input"
														/>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<!-- Campo simple -->
									<div>
										<label class="mb-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
											{getLabel(key)}
											{#if getSufijo(key)}
												<span class="text-[10px] text-[var(--text-dim)]">({getSufijo(key)})</span>
											{/if}
										</label>
										<input
											type="number"
											value={valor as number}
											step={key === 'margen_ganancia' || key === 'margen_led' ? '0.01' : '1'}
											oninput={(e) => {
												const target = e.currentTarget as HTMLInputElement;
												editando[item.id][key] = Number(target.value);
											}}
											class="param-input"
										/>
									</div>
								{/if}
							{/each}
						</div>

						<!-- Botón guardar -->
						<div
							class="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4"
						>
							<p class="text-[10px] text-[var(--text-dim)]">
								Los cambios se aplican a todas las calculadoras al guardar
							</p>
							<button
								onclick={() => guardar(item)}
								disabled={guardando === item.id}
								class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
							>
								{guardando === item.id ? 'Guardando...' : 'Guardar cambios'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if data.catalogo.length === 0}
		<div
			class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]"
		>
			No hay productos configurados en el catálogo
		</div>
	{/if}
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

	.param-input {
		width: 100%;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card-2);
		padding: 0.375rem 0.625rem;
		font-size: 0.8125rem;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
	}
	.param-input:focus {
		border-color: var(--brand);
	}
</style>
