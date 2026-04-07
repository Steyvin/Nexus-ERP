<script lang="ts">
	import { goto } from '$app/navigation'
	import { fmt } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { agregarItem, totalItems } from '$lib/stores/carrito'
	import { TIPO_LABEL } from '$lib/types'
	import {
		calcularNube,
		calcularLetra,
		calcularNeon,
		calcularVinilo,
		calcularAcrilio,
		calcularAcrilioCircular
	} from '$lib/utils/calculadoras'
	import { TODOS_COLORES } from '$lib/utils/calculadoras'
	import type { ApliqueNube, ColorAplique } from '$lib/utils/calculadoras'
	import type {
		ParametrosNube,
		ParametrosLetra,
		ParametrosNeon,
		ParametrosVinilo,
		ParametrosAcrilio,
		ParametrosAcrilioCircular,
		TipoProducto
	} from '$lib/types'
	import type { ResultadoCalculo } from '$lib/utils/calculadoras'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// ── Tabs ──
	const tabs: { tipo: TipoProducto; label: string }[] = [
		{ tipo: 'nube', label: 'Aviso Nube' },
		{ tipo: 'letra', label: 'Letra por Letra' },
		{ tipo: 'neon', label: 'Neon Flex' },
		{ tipo: 'vinilo', label: 'Vinilo' },
		{ tipo: 'acrilio', label: 'Acrílico' },
		{ tipo: 'acrilio_circular', label: 'Acrílico Circular' }
	]
	let tabActiva = $state<TipoProducto>('nube')

	// ── Inputs por calculadora ──
	let nube = $state({
		ancho_cm: 80,
		alto_cm: 60,
		cantidad_apliques: 0,
		apliques: [] as ApliqueNube[],
		perimetro_manual: 0,
		con_vinilo: false,
		vinilo_ancho_cm: 80,
		vinilo_alto_cm: 60,
		con_estructura: false,
		estructura_personalizada: 0,
		con_transporte: true
	})

	// Sincronizar cantidad de apliques con el array
	$effect(() => {
		const cant = nube.cantidad_apliques
		const actual = nube.apliques.length
		if (cant > actual) {
			const nuevos: ApliqueNube[] = []
			for (let i = 0; i < cant - actual; i++) {
				nuevos.push({ color: 'Blanco' as ColorAplique, ancho_cm: 30, alto_cm: 20 })
			}
			nube.apliques = [...nube.apliques, ...nuevos]
		} else if (cant < actual) {
			nube.apliques = nube.apliques.slice(0, cant)
		}
	})
	let letra = $state({ perimetro_cm: 200, cantidad_letras: 5 })
	let neon = $state<{ tamano: 'small' | 'medium' | 'large'; con_instalacion: boolean }>({
		tamano: 'small',
		con_instalacion: false
	})
	let vinilo = $state({ ancho_m: 1, alto_m: 1, con_instalacion: false })
	let acrilio = $state({ ancho_cm: 60, alto_cm: 40 })
	let acrilioCircular = $state<{ diametro: 'd40' | 'd50' | 'd60' | 'd70' | 'd80' }>({
		diametro: 'd40'
	})

	// ── Resultados reactivos ──
	let resultado = $derived.by((): ResultadoCalculo | null => {
		const p = data.parametros
		switch (tabActiva) {
			case 'nube':
				return p.nube ? calcularNube(nube, p.nube as unknown as ParametrosNube) : null
			case 'letra':
				return p.letra ? calcularLetra(letra, p.letra as unknown as ParametrosLetra) : null
			case 'neon':
				return p.neon ? calcularNeon(neon, p.neon as unknown as ParametrosNeon) : null
			case 'vinilo':
				return p.vinilo ? calcularVinilo(vinilo, p.vinilo as unknown as ParametrosVinilo) : null
			case 'acrilio':
				return p.acrilio ? calcularAcrilio(acrilio, p.acrilio as unknown as ParametrosAcrilio) : null
			case 'acrilio_circular':
				return p.acrilio_circular
					? calcularAcrilioCircular(acrilioCircular, p.acrilio_circular as unknown as ParametrosAcrilioCircular)
					: null
			default:
				return null
		}
	})

	function generarDescripcion(): string {
		switch (tabActiva) {
			case 'nube':
				return `Aviso Nube ${nube.ancho_cm}×${nube.alto_cm} cm${nube.apliques.length ? ` + ${nube.apliques.length} apliques` : ''}`
			case 'letra':
				return `${letra.cantidad_letras} letras, perímetro ${letra.perimetro_cm} cm`
			case 'neon': {
				const t = neon.tamano === 'small' ? 'Pequeño' : neon.tamano === 'medium' ? 'Mediano' : 'Grande'
				return `Neon Flex ${t}`
			}
			case 'vinilo':
				return `Vinilo ${vinilo.ancho_m}×${vinilo.alto_m} m`
			case 'acrilio':
				return `Acrílico ${acrilio.ancho_cm}×${acrilio.alto_cm} cm`
			case 'acrilio_circular':
				return `Acrílico Circular ${acrilioCircular.diametro.replace('d', '')} cm`
			default:
				return ''
		}
	}

	function agregarAlCarrito() {
		if (!resultado) return
		agregarItem({
			tipo: tabActiva,
			tipo_label: TIPO_LABEL[tabActiva],
			descripcion: generarDescripcion(),
			precio_fabricacion: Math.round(resultado.costoFabricacion),
			precio_cliente: Math.round(resultado.precioCliente),
			parametros: { desglose: resultado.desglose }
		})
		mostrarToast('Producto agregado al carrito')
	}
</script>

<svelte:head>
	<title>Calculadoras — Nexus LED</title>
</svelte:head>

<div>
	<h1 class="text-xl font-semibold text-[var(--text)]">Calculadoras de productos</h1>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Calcula costos de fabricación y precios al cliente</p>

	<!-- Tabs -->
	<div class="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1">
		{#each tabs as tab}
			<button
				onclick={() => (tabActiva = tab.tipo)}
				class="tab-btn whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors"
				class:tab-activa={tabActiva === tab.tipo}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Contenido -->
	<div class="mt-4 grid gap-4 lg:grid-cols-2">
		<!-- Panel de inputs -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Dimensiones y opciones</h2>

			{#if tabActiva === 'nube'}
				<div class="space-y-4">
					<!-- Medidas del aviso -->
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label-field">Ancho (cm)</label>
							<input type="number" bind:value={nube.ancho_cm} min="1" class="input-calc" />
						</div>
						<div>
							<label class="label-field">Alto (cm)</label>
							<input type="number" bind:value={nube.alto_cm} min="1" class="input-calc" />
						</div>
					</div>

					<!-- Perímetro manual (0 = auto) -->
					<div>
						<label class="label-field">Perímetro faja (cm)</label>
						<input type="number" bind:value={nube.perimetro_manual} min="0" class="input-calc" />
						<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">
							0 = automático ({nube.ancho_cm * 2 + nube.alto_cm * 2} cm)
						</p>
					</div>

					<!-- Apliques de acrílico -->
					<div>
						<label class="label-field">¿Cuántos apliques de acrílico?</label>
						<input type="number" bind:value={nube.cantidad_apliques} min="0" max="20" class="input-calc" />
					</div>

					{#if nube.apliques.length > 0}
						<div class="space-y-3 rounded-lg border border-[var(--border)] p-3">
							<p class="text-[11px] font-medium text-[var(--text-muted)]">Apliques</p>
							{#each nube.apliques as ap, idx}
								<div class="space-y-1.5 {idx > 0 ? 'border-t border-[var(--border)] pt-3' : ''}">
									<div class="flex items-center gap-2">
										<span class="w-5 text-center text-[10px] font-medium text-[var(--text-dim)]">{idx + 1}</span>
										<select
											bind:value={ap.color}
											class="input-calc flex-1"
										>
											{#each TODOS_COLORES as color}
												<option value={color}>{color}</option>
											{/each}
										</select>
									</div>
									<div class="flex items-center gap-2 pl-7">
										<input type="number" bind:value={ap.ancho_cm} min="1" class="input-calc flex-1" placeholder="Ancho" />
										<span class="text-[10px] text-[var(--text-dim)]">×</span>
										<input type="number" bind:value={ap.alto_cm} min="1" class="input-calc flex-1" placeholder="Alto" />
										<span class="text-[10px] text-[var(--text-dim)]">cm</span>
									</div>
								</div>
							{/each}
							<p class="text-[10px] text-[var(--text-dim)]">
								Dorado, Plateado y Oro Rosa se cobran a tarifa premium
							</p>
						</div>
					{/if}

					<!-- Vinilo -->
					<label class="toggle-row">
						<input type="checkbox" bind:checked={nube.con_vinilo} class="toggle-check" />
						<span class="text-sm text-[var(--text)]">Con vinilo</span>
					</label>
					{#if nube.con_vinilo}
						<div class="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border)] p-3">
							<div>
								<label class="label-field">Ancho vinilo (cm)</label>
								<input type="number" bind:value={nube.vinilo_ancho_cm} min="1" class="input-calc" />
							</div>
							<div>
								<label class="label-field">Alto vinilo (cm)</label>
								<input type="number" bind:value={nube.vinilo_alto_cm} min="1" class="input-calc" />
							</div>
						</div>
					{/if}

					<!-- Estructura -->
					<div>
						<label class="toggle-row">
							<input type="checkbox" bind:checked={nube.con_estructura} class="toggle-check" />
							<span class="text-sm text-[var(--text)]">Con estructura</span>
						</label>
						{#if nube.con_estructura}
							<div class="mt-2 rounded-lg border border-[var(--border)] p-3">
								<p class="text-[10px] text-[var(--text-dim)]">
									Automático: {Math.max(nube.ancho_cm, nube.alto_cm) <= 100 ? '$100.000' : Math.max(nube.ancho_cm, nube.alto_cm) <= 140 ? '$150.000' : '$200.000'}
									(mayor lado: {Math.max(nube.ancho_cm, nube.alto_cm)} cm)
								</p>
								<div class="mt-2">
									<label class="label-field">Precio personalizado ($)</label>
									<input type="number" bind:value={nube.estructura_personalizada} min="0" class="input-calc" />
									<p class="mt-0.5 text-[10px] text-[var(--text-dim)]">0 = usar precio automático</p>
								</div>
							</div>
						{/if}
					</div>

					<!-- Transporte -->
					<div>
						<label class="toggle-row">
							<input type="checkbox" bind:checked={nube.con_transporte} class="toggle-check" />
							<span class="text-sm text-[var(--text)]">Con transporte</span>
						</label>
						{#if nube.con_transporte}
							<p class="mt-1 text-[10px] text-[var(--text-dim)]">
								{Math.max(nube.ancho_cm, nube.alto_cm) > 80 ? '$80.000 (mayor a 80 cm)' : '$30.000 (hasta 80 cm)'}
							</p>
						{/if}
					</div>
				</div>

			{:else if tabActiva === 'letra'}
				<div class="space-y-4">
					<div>
						<label class="label-field">Perímetro total (cm)</label>
						<input type="number" bind:value={letra.perimetro_cm} min="1" class="input-calc" />
						<p class="mt-1 text-[10px] text-[var(--text-dim)]">Suma del perímetro de todas las letras</p>
					</div>
					<div>
						<label class="label-field">Cantidad de letras</label>
						<input type="number" bind:value={letra.cantidad_letras} min="1" class="input-calc" />
					</div>
				</div>

			{:else if tabActiva === 'neon'}
				<div class="space-y-4">
					<div>
						<label class="label-field">Tamaño</label>
						<div class="grid grid-cols-3 gap-2">
							{#each [
								{ val: 'small', label: 'Pequeño', sub: (data.parametros.neon as any)?.small?.medida ?? '' },
								{ val: 'medium', label: 'Mediano', sub: (data.parametros.neon as any)?.medium?.medida ?? '' },
								{ val: 'large', label: 'Grande', sub: (data.parametros.neon as any)?.large?.medida ?? '' }
							] as opt}
								<button
									onclick={() => (neon.tamano = opt.val as 'small' | 'medium' | 'large')}
									class="size-btn rounded-lg border p-3 text-center transition-colors"
									class:size-activo={neon.tamano === opt.val}
								>
									<span class="block text-sm font-medium">{opt.label}</span>
									<span class="block text-[10px] text-[var(--text-dim)]">{opt.sub}</span>
								</button>
							{/each}
						</div>
					</div>
					<label class="toggle-row">
						<input type="checkbox" bind:checked={neon.con_instalacion} class="toggle-check" />
						<span class="text-sm text-[var(--text)]">Con instalación</span>
					</label>
				</div>

			{:else if tabActiva === 'vinilo'}
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label-field">Ancho (m)</label>
							<input type="number" bind:value={vinilo.ancho_m} min="0.1" step="0.1" class="input-calc" />
						</div>
						<div>
							<label class="label-field">Alto (m)</label>
							<input type="number" bind:value={vinilo.alto_m} min="0.1" step="0.1" class="input-calc" />
						</div>
					</div>
					<label class="toggle-row">
						<input type="checkbox" bind:checked={vinilo.con_instalacion} class="toggle-check" />
						<span class="text-sm text-[var(--text)]">Con instalación</span>
					</label>
					{#if data.parametros.vinilo}
						<p class="text-[10px] text-[var(--text-dim)]">
							Instalación gratis desde {(data.parametros.vinilo as any).gratis_desde_m2} m²
						</p>
					{/if}
				</div>

			{:else if tabActiva === 'acrilio'}
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label-field">Ancho (cm)</label>
							<input type="number" bind:value={acrilio.ancho_cm} min="1" class="input-calc" />
						</div>
						<div>
							<label class="label-field">Alto (cm)</label>
							<input type="number" bind:value={acrilio.alto_cm} min="1" class="input-calc" />
						</div>
					</div>
				</div>

			{:else if tabActiva === 'acrilio_circular'}
				<div class="space-y-4">
					<div>
						<label class="label-field">Diámetro</label>
						<div class="grid grid-cols-5 gap-2">
							{#each ['d40', 'd50', 'd60', 'd70', 'd80'] as d}
								<button
									onclick={() => (acrilioCircular.diametro = d as any)}
									class="size-btn rounded-lg border p-3 text-center transition-colors"
									class:size-activo={acrilioCircular.diametro === d}
								>
									<span class="block text-sm font-medium">{d.replace('d', '')} cm</span>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Panel de resultados -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
			<h2 class="mb-4 text-sm font-medium text-[var(--text)]">Desglose de costos</h2>

			{#if !resultado}
				<p class="py-8 text-center text-sm text-[var(--text-dim)]">
					No hay parámetros configurados para este producto.
					<a href="/configuracion/catalogo" class="text-[var(--brand-light)] hover:underline">Configurar</a>
				</p>
			{:else}
				<table class="w-full text-sm">
					<tbody>
						{#each resultado.desglose as linea}
							<tr class="border-b border-[var(--border)]">
								<td class="py-2.5 text-[var(--text-muted)]">{linea.concepto}</td>
								<td class="py-2.5 text-right font-medium text-[var(--text)]">{fmt(linea.valor)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- Totales -->
				<div class="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
					<div class="flex items-center justify-between">
						<span class="text-sm text-[var(--text-muted)]">Costo de fabricación</span>
						<span class="text-lg font-semibold text-[var(--warning)]">
							{fmt(resultado.costoFabricacion)}
						</span>
					</div>
					{#if resultado.margen > 0}
						<div class="flex items-center justify-between">
							<span class="text-sm text-[var(--text-muted)]">
								Ganancia ({Math.round(resultado.margen * 100)}%)
							</span>
							<span class="text-sm text-[var(--success)]">
								+{fmt(resultado.precioCliente - resultado.costoFabricacion)}
							</span>
						</div>
					{/if}
					<div class="flex items-center justify-between rounded-lg bg-[var(--brand-dark)] px-4 py-3">
						<span class="text-sm font-medium text-[var(--brand-light)]">Precio al cliente</span>
						<span class="text-xl font-bold text-[var(--text)]">
							{fmt(resultado.precioCliente)}
						</span>
					</div>

					<!-- Agregar al carrito -->
					<button
						onclick={agregarAlCarrito}
						class="btn-primary mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
						Agregar al carrito
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Indicador flotante del carrito -->
	{#if $totalItems > 0}
		<a
			href="/cotizaciones/nueva"
			class="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
			Ver carrito ({$totalItems})
		</a>
	{/if}
</div>

<style>
	.btn-primary {
		background: var(--brand);
		color: #fff;
		transition: background 0.15s;
	}
	.btn-primary:hover {
		background: var(--brand-light);
	}

	.tab-btn {
		color: var(--text-muted);
		background: transparent;
	}
	.tab-btn:hover {
		color: var(--text);
		background: rgba(255, 255, 255, 0.04);
	}
	.tab-activa {
		color: var(--brand-light) !important;
		background: color-mix(in srgb, var(--brand) 15%, transparent) !important;
	}

	.label-field {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.input-calc {
		width: 100%;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card-2);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
	}
	.input-calc:focus {
		border-color: var(--brand);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	.toggle-check {
		accent-color: var(--brand);
		width: 1rem;
		height: 1rem;
	}

	.size-btn {
		border-color: var(--border);
		color: var(--text-muted);
		background: transparent;
	}
	.size-btn:hover {
		border-color: var(--border-light);
		color: var(--text);
	}
	.size-activo {
		border-color: var(--brand) !important;
		color: var(--brand-light) !important;
		background: color-mix(in srgb, var(--brand) 10%, transparent) !important;
	}
</style>
