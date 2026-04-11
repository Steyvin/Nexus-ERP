<script lang="ts">
	import logoNexus from '$lib/assets/NEXUS.png'
	import { goto } from '$app/navigation'
	import { fmt } from '$lib/utils/format'
	import { mostrarToast } from '$lib/stores/ui'
	import { agregarItem, totalItems } from '$lib/stores/carrito'
	import { toPng, toBlob } from 'html-to-image'
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
	import type { ApliqueNube, ColorAplique, InputLetra } from '$lib/utils/calculadoras'
	import ColorSelect from './ColorSelect.svelte'
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
	const tabs: { tipo: TipoProducto; label: string; icon: string; desc: string }[] = [
		{ tipo: 'nube', label: 'Aviso Nube', icon: '☁️', desc: 'Figura rectangular continua' },
		{ tipo: 'letra', label: 'Letra por Letra', icon: '🔤', desc: 'Letras individuales' },
		{ tipo: 'neon', label: 'Neon Flex', icon: '💡', desc: 'Letrero luminoso neon' },
		{ tipo: 'vinilo', label: 'Vinilo', icon: '🖼️', desc: 'Aplicación por m²' },
		{ tipo: 'acrilio', label: 'Acrílico', icon: '🔶', desc: 'Base, apliques y LED' },
		{ tipo: 'acrilio_circular', label: 'Circular', icon: '⚪', desc: 'Aviso redondo' }
	]
	let tabActiva = $state<TipoProducto>('nube')

	// ── Inputs por calculadora ──
	let nube = $state({
		ancho_cm: 80,
		alto_cm: 60,
		cantidad_apliques: 0,
		apliques: [] as ApliqueNube[],
		perimetro_manual: 0,
		faja_grosor_custom: false,
		faja_ancho_cm: 6,
		con_vinilo: false,
		vinilo_ancho_cm: 80,
		vinilo_alto_cm: 60,
		con_estructura: false,
		estructura_personalizada_activa: false,
		estructura_personalizada: 0,
		mdo_personalizada: false,
		mdo_custom: 0,
		con_transporte: true
	})

	let letra = $state<InputLetra>({
		ancho_cm: 100,
		alto_cm: 50,
		perimetro_cm: 200,
		faja_grosor_custom: false,
		faja_ancho_cm: 6,
		cantidad_apliques: 0,
		apliques: [],
		con_estructura: false,
		estructura_personalizada_activa: false,
		estructura_personalizada: 0,
		mdo_personalizada: false,
		mdo_custom: 0,
		con_transporte: true,
		con_vinilo: false,
		vinilo_ancho_cm: 100,
		vinilo_alto_cm: 50
	})

	// Sincronizar cantidad de apliques con el array (NUBE)
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

	// Sincronizar cantidad de apliques con el array (LETRA)
	$effect(() => {
		const cant = letra.cantidad_apliques
		const actual = letra.apliques.length
		if (cant > actual) {
			const nuevos: ApliqueNube[] = []
			for (let i = 0; i < cant - actual; i++) {
				nuevos.push({ color: 'Blanco' as ColorAplique, ancho_cm: 30, alto_cm: 20 })
			}
			letra.apliques = [...letra.apliques, ...nuevos]
		} else if (cant < actual) {
			letra.apliques = letra.apliques.slice(0, cant)
		}
	})
	let neon = $state<{
		tamano: 'small' | 'medium' | 'large' | 'custom'
		con_instalacion: boolean
		custom_ancho_cm: number
		custom_alto_cm: number
		custom_grosor: '3mm' | '6mm'
		custom_con_vinilo: boolean
		custom_vinilo_ancho_cm: number
		custom_vinilo_alto_cm: number
	}>({
		tamano: 'small',
		con_instalacion: false,
		custom_ancho_cm: 60,
		custom_alto_cm: 40,
		custom_grosor: '3mm',
		custom_con_vinilo: false,
		custom_vinilo_ancho_cm: 60,
		custom_vinilo_alto_cm: 40
	})
	let vinilo = $state<{
		cantidad_pedazos: number
		pedazos: { ancho_cm: number; alto_cm: number }[]
		con_instalacion: boolean
	}>({
		cantidad_pedazos: 1,
		pedazos: [{ ancho_cm: 100, alto_cm: 100 }],
		con_instalacion: false
	})

	// Sincronizar cantidad de pedazos de vinilo
	$effect(() => {
		const cant = typeof vinilo.cantidad_pedazos === 'number' && !isNaN(vinilo.cantidad_pedazos) ? Math.max(1, vinilo.cantidad_pedazos) : 1
		const actual = vinilo.pedazos.length
		if (cant > actual) {
			const nuevos = []
			for (let i = 0; i < cant - actual; i++) {
				nuevos.push({ ancho_cm: 100, alto_cm: 100 })
			}
			vinilo.pedazos = [...vinilo.pedazos, ...nuevos]
		} else if (cant < actual) {
			vinilo.pedazos = vinilo.pedazos.slice(0, cant)
		}
	})

	// ── Simulador Neon ──
	let simTexto = $state('Tu Texto')
	let simFuente = $state('Allanis')
	let simColor = $state('#ff2d78')
	let simFondo = $state('#0a0a0a')
	let simAlign = $state<'left' | 'center' | 'right'>('center')
	let simRef = $state<HTMLElement | null>(null)

	async function descargarSimulacion() {
		if (!simRef) return
		try {
			const dataUrl = await toPng(simRef, { quality: 1, pixelRatio: 2 })
			const link = document.createElement('a')
			link.download = 'neon-simulacion.png'
			link.href = dataUrl
			link.click()
		} catch (e) {
			mostrarToast('Error al descargar imagen', 'error')
		}
	}

	async function copiarSimulacion() {
		if (!simRef) return
		try {
			const blob = await toBlob(simRef, { quality: 1, pixelRatio: 2 })
			if (blob) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
				mostrarToast('Imagen copiada al portapapeles')
			}
		} catch (e) {
			mostrarToast('Error al copiar imagen', 'error')
		}
	}

	async function toggleFullscreen() {
		if (!simRef) return
		try {
			if (!document.fullscreenElement) {
				await simRef.requestFullscreen()
			} else {
				await document.exitFullscreen()
			}
		} catch (e) {
			mostrarToast('Pantalla completa no soportada', 'error')
		}
	}

	// Tamaños calibrados para que cada fuente se vea visualmente del mismo tamaño
	// (las fuentes script tienen cap-heights muy distintos entre sí)
	const FONT_SIZES: Record<string, string> = {
		'Allanis':      '3.5rem',
		'Barcelony':    '3rem',
		'Barokah':      '2.4rem',
		'Cosmopolitan': '3rem',
		'Elegant':      '4.2rem',
		'HanleyPro':    '3.6rem',
		'Hattinand':    '3.8rem',
		'Sacramento':   '5rem'
	}

	const NEON_FONTS = [
		{ key: 'Allanis', label: 'Allanis' },
		{ key: 'Barcelony', label: 'Barcelony' },
		{ key: 'Barokah', label: 'Barokah' },
		{ key: 'Cosmopolitan', label: 'Cosmopolitan' },
		{ key: 'Elegant', label: 'Elegant' },
		{ key: 'HanleyPro', label: 'Hanley Pro' },
		{ key: 'Hattinand', label: 'Hattinand' },
		{ key: 'Sacramento', label: 'Sacramento' }
	]

	let simFontSizeRem = $state(3.5)
	let simLineHeight = $state(1.3)
	$effect(() => {
		simFontSizeRem = parseFloat(FONT_SIZES[simFuente] ?? '3.5')
	})
	const simFontSize = $derived(`${simFontSizeRem}rem`)

	const NEON_COLORS = [
		{ hex: '#ff2d78', label: 'Rosa' },
		{ hex: '#00f3ff', label: 'Cyan' },
		{ hex: '#39ff14', label: 'Verde' },
		{ hex: '#ffff00', label: 'Amarillo' },
		{ hex: '#ff6b00', label: 'Naranja' },
		{ hex: '#bf00ff', label: 'Morado' },
		{ hex: '#ffffff', label: 'Blanco' },
		{ hex: '#ff4444', label: 'Rojo' }
	]

	const NEON_FONDOS = [
		{ hex: '#0a0a0a', label: 'Negro' },
		{ hex: '#0a0a2e', label: 'Azul oscuro' },
		{ hex: '#0a1a0a', label: 'Verde oscuro' },
		{ hex: '#1a0010', label: 'Vino oscuro' },
		{ hex: '#1a1a1a', label: 'Gris oscuro' },
		{ hex: '#ffffff', label: 'Blanco' }
	]

	const simGlow = $derived(
		`0 0 6px #fff, 0 0 12px #fff, 0 0 20px ${simColor}, 0 0 40px ${simColor}, 0 0 70px ${simColor}, 0 0 100px ${simColor}`
	)
	let acrilio = $state({ ancho_cm: 60, alto_cm: 40, con_iluminacion: false, con_microporosa: false })
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
			case 'neon': {
				if (!p.neon) return null
				// Para tamaño personalizado, usar el precio de vinilo del aviso nube
				const neonParams = {
					...(p.neon as unknown as ParametrosNeon),
					precio_vinilo_m2: (p.nube as any)?.precio_vinilo_m2 ?? 0
				}
				return calcularNeon(neon, neonParams)
			}
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
				return `Aviso Nube ${nube.ancho_cm} X ${nube.alto_cm} cm${nube.apliques.length ? ` + ${nube.apliques.length} apliques` : ''}`
			case 'letra':
				return `Aviso Letra ${letra.ancho_cm} X ${letra.alto_cm} cm, perim. ${letra.perimetro_cm}cm${letra.apliques.length ? ` + ${letra.apliques.length} apliques` : ''}`
			case 'neon': {
				if (neon.tamano === 'custom') {
					return `Neon Flex Personalizado ${neon.custom_ancho_cm} X ${neon.custom_alto_cm} cm (Acrílico ${neon.custom_grosor})`
				}
				const t = neon.tamano === 'small' ? 'Pequeño' : neon.tamano === 'medium' ? 'Mediano' : 'Grande'
				return `Neon Flex ${t}`
			}
			case 'vinilo': {
				if (vinilo.pedazos.length === 1) {
					return `Vinilo ${vinilo.pedazos[0].ancho_cm} X ${vinilo.pedazos[0].alto_cm} cm`
				}
				const area_total = vinilo.pedazos.reduce((sum, p) => sum + (p.ancho_cm * p.alto_cm) / 10000, 0)
				return `Vinilo (${vinilo.pedazos.length} piezas, total ${area_total.toFixed(2)} m²)`
			}
			case 'acrilio':
				return `Acrílico ${acrilio.ancho_cm} X ${acrilio.alto_cm} cm`
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
	<title>Cotizador — Nexus LED</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Exo+2:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
		@font-face { font-family: 'Allanis';       src: url('/fonts/neon/Allanis (DEMO).ttf'); }
		@font-face { font-family: 'Barcelony';      src: url('/fonts/neon/Barcelony.ttf'); }
		@font-face { font-family: 'Barokah';        src: url('/fonts/neon/Barokah Signature by Alifinart Studio.ttf'); }
		@font-face { font-family: 'Cosmopolitan';   src: url('/fonts/neon/CosmopolitanScriptRegular.otf'); }
		@font-face { font-family: 'Elegant';        src: url('/fonts/neon/Elegant DEMO.ttf'); }
		@font-face { font-family: 'HanleyPro';      src: url('/fonts/neon/HanleyPro-Monoline.ttf'); }
		@font-face { font-family: 'Hattinand';      src: url('/fonts/neon/Hattinand.otf'); }
		@font-face { font-family: 'Sacramento';     src: url('/fonts/neon/Sacramento-Regular.ttf'); }
	</style>
</svelte:head>

<div class="calculator-root font-exo">
	<div class="hero-header">
		<h1 class="title-glow font-rajdhani">Cotizador de Avisos</h1>
		<p class="subtitle">Calcula al instante el precio de tu aviso con diseño profesional.</p>
	</div>

	<!-- Tabs / Tipo de Aviso -->
	<div class="modern-card mb-6">
		<div class="card-header">
			<div class="card-icon">📋</div>
			<div>
				<h2 class="card-title font-rajdhani">Tipo de aviso</h2>
				<p class="card-desc">Selecciona cómo está compuesto el aviso</p>
			</div>
		</div>
		<div class="tipo-grid">
			{#each tabs as tab}
				<button
					onclick={() => (tabActiva = tab.tipo)}
					class="tipo-btn {tabActiva === tab.tipo ? 'active' : ''}"
				>
					<span class="tipo-icon">{tab.icon}</span>
					<span class="tipo-nombre font-rajdhani">{tab.label}</span>
					<span class="tipo-hint">{tab.desc}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Contenido -->
	<div class="grid gap-6 lg:grid-cols-12">
		<!-- Panel de inputs -->
		<div class="lg:col-span-7 flex flex-col gap-4">

			{#if tabActiva === 'nube'}
				<!-- Medidas -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">📐</div>
						<div class="sc-texts">
							<h3 class="sc-title">Medidas del aviso</h3>
							<p class="sc-desc">Ancho y alto en centímetros</p>
						</div>
					</div>
					<div class="sc-content">
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="label-field">Ancho (cm)</label>
								<input type="number" bind:value={nube.ancho_cm} min="1" class="input-calc" placeholder="Ej: 60" />
							</div>
							<div>
								<label class="label-field">Alto (cm)</label>
								<input type="number" bind:value={nube.alto_cm} min="1" class="input-calc" placeholder="Ej: 40" />
							</div>
						</div>
						<!-- Faja -->
						<div class="mt-2 border-t border-[var(--border)] pt-4">
							<label class="toggle-row-between">
									<div class="toggle-label-group">
										<span class="toggle-label-main">Configurar faja</span>
										<span class="toggle-label-sub">Modificar grosor y perímetro estándar</span>
									</div>
									<input type="checkbox" bind:checked={nube.faja_grosor_custom} class="toggle-check" />
								</label>
								{#if nube.faja_grosor_custom}
									<div class="mt-4 grid grid-cols-2 gap-3">
										<div>
											<label class="label-field">Perímetro faja (cm)</label>
											<input type="number" bind:value={nube.perimetro_manual} min="0" class="input-calc" />
											<p class="mt-1 text-[10px] text-[var(--text-dim)]">0 = auto ({nube.ancho_cm * 2 + nube.alto_cm * 2} cm)</p>
										</div>
										<div>
											<label class="label-field">Grosor faja (cm)</label>
											<input type="number" bind:value={nube.faja_ancho_cm} min="1" class="input-calc" />
										</div>
									</div>
								{/if}
						</div>
					</div>
				</div>

				<!-- Apliques -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🎨</div>
						<div class="sc-texts">
							<h3 class="sc-title">Apliques de Acrílico</h3>
							<p class="sc-desc">Colores adicionales sobre el aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<div>
							<label class="label-field">¿Cuántos apliques (colores) lleva?</label>
							<input type="number" bind:value={nube.cantidad_apliques} min="0" max="20" class="input-calc" placeholder="Ej: 2" />
						</div>
						{#if nube.apliques.length > 0}
							<div class="space-y-3 rounded-lg bg-[#080808] border border-(--border) p-4">
								{#each nube.apliques as ap, idx}
									<div class="space-y-2 {idx > 0 ? 'border-t border-(--border) pt-3' : ''}">
										<div class="flex items-center gap-2">
											<span class="w-6 text-center text-xs font-semibold text-[var(--text-dim)]">{idx + 1}</span>
											<ColorSelect bind:value={ap.color} />
										</div>
										<div class="flex items-center gap-2 pl-8">
											<input type="number" bind:value={ap.ancho_cm} min="1" class="input-calc flex-1 bg-[#121212] border-0" placeholder="Ancho" />
											<span class="text-[10px] text-[var(--text-dim)]">X</span>
											<input type="number" bind:value={ap.alto_cm} min="1" class="input-calc flex-1 bg-[#121212] border-0" placeholder="Alto" />
										</div>
									</div>
								{/each}
								<p class="text-[10px] text-(--brand-light) pt-1 text-center font-medium opacity-80">Dorado, Plateado y Oro Rosa se cobran como tarifa premium.</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Transporte e Instalacion -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🚚</div>
						<div class="sc-texts">
							<h3 class="sc-title">Transporte</h3>
							<p class="sc-desc">Incluye envío y entrega del aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Requiere transporte?</span>
								<span class="toggle-label-sub">Se suma costo de flete según tamaño</span>
							</div>
							<input type="checkbox" bind:checked={nube.con_transporte} class="toggle-check" />
						</label>
					</div>
				</div>

				<!-- Vinilo -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🖼️</div>
						<div class="sc-texts">
							<h3 class="sc-title">Vinilo</h3>
							<p class="sc-desc">Aplicación de vinilo de corte o impreso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Lleva vinilo?</span>
								<span class="toggle-label-sub">Costos por metro cuadrado</span>
							</div>
							<input type="checkbox" bind:checked={nube.con_vinilo} class="toggle-check" />
						</label>
						{#if nube.con_vinilo}
							<div class="grid grid-cols-2 gap-3 mt-1">
								<div>
									<label class="label-field">Ancho (cm)</label>
									<input type="number" bind:value={nube.vinilo_ancho_cm} min="1" class="input-calc" />
								</div>
								<div>
									<label class="label-field">Alto (cm)</label>
									<input type="number" bind:value={nube.vinilo_alto_cm} min="1" class="input-calc" />
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Estructura -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🏗️</div>
						<div class="sc-texts">
							<h3 class="sc-title">Estructura</h3>
							<p class="sc-desc">Soporte metálico o base del aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Necesita estructura?</span>
								<span class="toggle-label-sub">Soporte adicional para fijación</span>
							</div>
							<input type="checkbox" bind:checked={nube.con_estructura} class="toggle-check" />
						</label>
						{#if nube.con_estructura}
							<label class="toggle-row-between mt-1 pt-3 border-t border-[var(--border)]">
								<div class="toggle-label-group">
									<span class="toggle-label-main">Estructura especial</span>
									<span class="toggle-label-sub">Activar para ingresar cotización manual</span>
								</div>
								<input type="checkbox" bind:checked={nube.estructura_personalizada_activa} class="toggle-check" />
							</label>
							{#if nube.estructura_personalizada_activa}
								<div class="mt-2">
									<label class="label-field">Valor de estructura manual ($)</label>
									<input type="number" bind:value={nube.estructura_personalizada} min="1" class="input-calc" />
								</div>
							{:else}
								<p class="mt-1 text-[11px] font-medium text-[var(--brand-light)] opacity-70">Calculando valor automático por tamaño del nube.</p>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Mano de Obra -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🔧</div>
						<div class="sc-texts">
							<h3 class="sc-title">Mano de Obra</h3>
							<p class="sc-desc">Incluida en el precio</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">Modificar mano de obra</span>
								<span class="toggle-label-sub">Activar para casos complejos excepcionales</span>
							</div>
							<input type="checkbox" bind:checked={nube.mdo_personalizada} class="toggle-check" />
						</label>
						{#if nube.mdo_personalizada}
							<div class="mt-2">
								<label class="label-field">Mano de obra ($)</label>
								<input type="number" bind:value={nube.mdo_custom} min="1" class="input-calc" />
							</div>
						{/if}
					</div>
				</div>



			

			{:else if tabActiva === 'letra'}
				<!-- Medidas -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">📐</div>
						<div class="sc-texts">
							<h3 class="sc-title">Medidas del aviso</h3>
							<p class="sc-desc">Ancho y alto en centímetros</p>
						</div>
					</div>
					<div class="sc-content">
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="label-field">Ancho (cm)</label>
								<input type="number" bind:value={letra.ancho_cm} min="1" class="input-calc" placeholder="Ej: 60" />
							</div>
							<div>
								<label class="label-field">Alto (cm)</label>
								<input type="number" bind:value={letra.alto_cm} min="1" class="input-calc" placeholder="Ej: 40" />
							</div>
						</div>
						<!-- Faja -->
						<div class="mt-2 border-t border-[var(--border)] pt-4">
							
								<!-- Letra a letra -->
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="label-field">Perímetro Total (cm)</label>
										<input type="number" bind:value={letra.perimetro_cm} min="1" class="input-calc" />
										<p class="mt-1 text-[10px] text-[var(--text-dim)]">Suma de la cuerda de todas las letras</p>
									</div>
									<div class="flex flex-col justify-end">
										<label class="toggle-row-between mb-2">
											<div class="toggle-label-group">
												<span class="toggle-label-main">Cambiar grosor faja</span>
												<span class="toggle-label-sub">Por defecto: 6 cm</span>
											</div>
											<input type="checkbox" bind:checked={letra.faja_grosor_custom} class="toggle-check" />
										</label>
										{#if letra.faja_grosor_custom}
											<div>
												<label class="label-field">Grosor manual (cm)</label>
												<input type="number" bind:value={letra.faja_ancho_cm} min="1" class="input-calc" />
											</div>
										{/if}
									</div>
								</div>
							</div>
					</div>
				</div>

				<!-- Apliques -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🎨</div>
						<div class="sc-texts">
							<h3 class="sc-title">Apliques de Acrílico</h3>
							<p class="sc-desc">Colores adicionales sobre el aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<div>
							<label class="label-field">¿Cuántos apliques (colores) lleva?</label>
							<input type="number" bind:value={letra.cantidad_apliques} min="0" max="20" class="input-calc" placeholder="Ej: 2" />
						</div>
						{#if letra.apliques.length > 0}
							<div class="space-y-3 rounded-lg bg-[#080808] border border-(--border) p-4">
								{#each letra.apliques as ap, idx}
									<div class="space-y-2 {idx > 0 ? 'border-t border-(--border) pt-3' : ''}">
										<div class="flex items-center gap-2">
											<span class="w-6 text-center text-xs font-semibold text-[var(--text-dim)]">{idx + 1}</span>
											<ColorSelect bind:value={ap.color} />
										</div>
										<div class="flex items-center gap-2 pl-8">
											<input type="number" bind:value={ap.ancho_cm} min="1" class="input-calc flex-1 bg-[#121212] border-0" placeholder="Ancho" />
											<span class="text-[10px] text-[var(--text-dim)]">X</span>
											<input type="number" bind:value={ap.alto_cm} min="1" class="input-calc flex-1 bg-[#121212] border-0" placeholder="Alto" />
										</div>
									</div>
								{/each}
								<p class="text-[10px] text-(--brand-light) pt-1 text-center font-medium opacity-80">Dorado, Plateado y Oro Rosa se cobran como tarifa premium.</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Transporte e Instalacion -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🚚</div>
						<div class="sc-texts">
							<h3 class="sc-title">Transporte</h3>
							<p class="sc-desc">Incluye envío y entrega del aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Requiere transporte?</span>
								<span class="toggle-label-sub">Se suma costo de flete según tamaño</span>
							</div>
							<input type="checkbox" bind:checked={letra.con_transporte} class="toggle-check" />
						</label>
					</div>
				</div>

				<!-- Vinilo -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🖼️</div>
						<div class="sc-texts">
							<h3 class="sc-title">Vinilo</h3>
							<p class="sc-desc">Aplicación de vinilo de corte o impreso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Lleva vinilo?</span>
								<span class="toggle-label-sub">Costos por metro cuadrado</span>
							</div>
							<input type="checkbox" bind:checked={letra.con_vinilo} class="toggle-check" />
						</label>
						{#if letra.con_vinilo}
							<div class="grid grid-cols-2 gap-3 mt-1">
								<div>
									<label class="label-field">Ancho (cm)</label>
									<input type="number" bind:value={letra.vinilo_ancho_cm} min="1" class="input-calc" />
								</div>
								<div>
									<label class="label-field">Alto (cm)</label>
									<input type="number" bind:value={letra.vinilo_alto_cm} min="1" class="input-calc" />
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Estructura -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🏗️</div>
						<div class="sc-texts">
							<h3 class="sc-title">Estructura</h3>
							<p class="sc-desc">Soporte metálico o base del aviso</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Necesita estructura?</span>
								<span class="toggle-label-sub">Soporte adicional para fijación</span>
							</div>
							<input type="checkbox" bind:checked={letra.con_estructura} class="toggle-check" />
						</label>
						{#if letra.con_estructura}
							<label class="toggle-row-between mt-1 pt-3 border-t border-[var(--border)]">
								<div class="toggle-label-group">
									<span class="toggle-label-main">Estructura especial</span>
									<span class="toggle-label-sub">Activar para ingresar cotización manual</span>
								</div>
								<input type="checkbox" bind:checked={letra.estructura_personalizada_activa} class="toggle-check" />
							</label>
							{#if letra.estructura_personalizada_activa}
								<div class="mt-2">
									<label class="label-field">Valor de estructura manual ($)</label>
									<input type="number" bind:value={letra.estructura_personalizada} min="1" class="input-calc" />
								</div>
							{:else}
								<p class="mt-1 text-[11px] font-medium text-[var(--brand-light)] opacity-70">Calculando valor automático por tamaño del letra.</p>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Mano de Obra -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🔧</div>
						<div class="sc-texts">
							<h3 class="sc-title">Mano de Obra</h3>
							<p class="sc-desc">Incluida en el precio</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">Modificar mano de obra</span>
								<span class="toggle-label-sub">Activar para casos complejos excepcionales</span>
							</div>
							<input type="checkbox" bind:checked={letra.mdo_personalizada} class="toggle-check" />
						</label>
						{#if letra.mdo_personalizada}
							<div class="mt-2">
								<label class="label-field">Mano de obra ($)</label>
								<input type="number" bind:value={letra.mdo_custom} min="1" class="input-calc" />
							</div>
						{/if}
					</div>
				</div>



			{:else if tabActiva === 'neon'}

				<!-- Simulador visual de Neon Flex -->
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">✨</div>
						<div class="sc-texts">
							<h3 class="sc-title">Simulador de Neon</h3>
							<p class="sc-desc">Previsualiza cómo quedaría el aviso</p>
						</div>
					</div>
					<div class="sc-content">

						<!-- SVG Filter para efecto acrílico (invisible) -->
						<svg style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">
							<defs>
								<filter id="neon-acrylic-filter" x="-40%" y="-80%" width="180%" height="260%">
									<feMorphology in="SourceAlpha" operator="dilate" radius="7" result="silueta"/>
									<feFlood flood-color="#ffffff" flood-opacity="0.07" result="acrylicFill"/>
									<feComposite in="acrylicFill" in2="silueta" operator="in" result="relleno"/>
									<feMorphology in="SourceAlpha" operator="dilate" radius="7" result="bordeExt"/>
									<feMorphology in="SourceAlpha" operator="dilate" radius="4" result="bordeInt"/>
									<feComposite in="bordeExt" in2="bordeInt" operator="out" result="anillo"/>
									<feFlood flood-color={simColor} flood-opacity="0.85" result="colorBorde"/>
									<feComposite in="colorBorde" in2="anillo" operator="in" result="bordeColoreado"/>
									<feGaussianBlur in="bordeColoreado" stdDeviation="1.5" result="bordeGlow"/>
									<feGaussianBlur in="silueta" stdDeviation="8" result="haloBlur"/>
									<feFlood flood-color={simColor} flood-opacity="0.28" result="colorHalo"/>
									<feComposite in="colorHalo" in2="haloBlur" operator="in" result="halo"/>
									<feMerge>
										<feMergeNode in="halo"/>
										<feMergeNode in="relleno"/>
										<feMergeNode in="bordeGlow"/>
										<feMergeNode in="SourceGraphic"/>
									</feMerge>
								</filter>
							</defs>
						</svg>

						<!-- Preview box -->
						<div bind:this={simRef} class="sim-preview-box" style="background: {simFondo};">
							<!-- Overlay Badge -->
							{#if resultado}
							<div class="absolute top-5 left-5 rounded-xl bg-[rgba(0,0,0,0.75)] px-5 py-3.5 backdrop-blur-md border border-[rgba(255,255,255,0.15)] z-20 shadow-xl">
								<span class="block text-base font-semibold text-[rgba(255,255,255,0.95)] mb-1">
									{#if neon.tamano === 'custom'}
										{neon.custom_ancho_cm} X {neon.custom_alto_cm} cm
									{:else}
										{((data.parametros.neon as any)?.[neon.tamano]?.medida ?? '').replace(/(?:×|├ù)/gi, ' X ').replace(/ +X +/g, ' X ').trim()}
									{/if}
								</span>
								<span class="block text-2xl text-[var(--brand-light)] font-bold opacity-100 drop-shadow-md mt-0.5">{fmt(resultado.precioCliente)}</span>
							</div>
							{/if}
							<div class="flex flex-col items-center justify-center gap-[4.5rem] z-10 w-full relative pt-8">
								<div class="sim-acrylic" style="filter: url(#neon-acrylic-filter);">
									<div
										class="sim-neon-text"
										style="font-family: '{simFuente}', cursive, sans-serif; font-size: {simFontSize}; line-height: {simLineHeight}; text-align: {simAlign}; text-shadow: {simGlow};"
									>{@html simTexto.replace(/\n/g, '<br>')}</div>
								</div>
								
								<img src={logoNexus} alt="Nexus LED" class="h-9 opacity-35 pointer-events-none" />
							</div>
						</div>

						<div class="flex gap-2 justify-end -mt-2">
							<button onclick={toggleFullscreen} class="btn-secondary rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-1.5 bg-[#0a0a0a]" title="Pantalla completa">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>
								Completa
							</button>
							<button onclick={copiarSimulacion} class="btn-secondary rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-1.5 bg-[#0a0a0a]">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
								Copiar
							</button>
							<button onclick={descargarSimulacion} class="btn-secondary rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-1.5 bg-[#0a0a0a]">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
								Descargar
							</button>
						</div>

						<!-- Input de texto -->
						<div>
							<label class="label-field">Texto del neon</label>
							<textarea
								bind:value={simTexto}
								rows="2"
								placeholder="Escribe aquí..."
								class="input-calc w-full resize-none"
							></textarea>
						</div>

						<!-- Tipografía -->
						<div>
							<label class="label-field">Tipografía</label>
							<div class="sim-font-row">
								{#each NEON_FONTS as f}
									<button
										onclick={() => (simFuente = f.key)}
										class="sim-font-pill"
										class:sim-font-active={simFuente === f.key}
										style="font-family: '{f.key}', cursive;"
									>{f.label}</button>
								{/each}
							</div>
						</div>

						<!-- Tamaño de fuente -->
						<div>
							<div class="flex items-center justify-between mb-1">
								<label class="label-field" style="margin:0">Tamaño de fuente</label>
								<span class="text-xs text-[var(--text-dim)]">{simFontSizeRem.toFixed(1)} rem</span>
							</div>
							<input
								type="range"
								min="1"
								max="8"
								step="0.1"
								bind:value={simFontSizeRem}
								class="sim-size-slider w-full"
							/>
							<div class="flex justify-between text-[10px] text-[var(--text-dim)] mt-1">
								<span>Pequeño</span>
								<span>Grande</span>
							</div>
						</div>

						<!-- Interlineado -->
						<div>
							<div class="flex items-center justify-between mb-1">
								<label class="label-field" style="margin:0">Interlineado</label>
								<span class="text-xs text-[var(--text-dim)]">{simLineHeight.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="0.8"
								max="3"
								step="0.1"
								bind:value={simLineHeight}
								class="sim-size-slider w-full"
							/>
							<div class="flex justify-between text-[10px] text-[var(--text-dim)] mt-1">
								<span>Compacto</span>
								<span>Separado</span>
							</div>
						</div>

						<!-- Color neon -->
						<div>
							<label class="label-field">Color del neon</label>
							<div class="sim-swatch-row">
								{#each NEON_COLORS as c}
									<button
										onclick={() => (simColor = c.hex)}
										class="sim-swatch"
										class:sim-swatch-active={simColor === c.hex}
										style="background: {c.hex}; {c.hex === '#ffffff' ? 'box-shadow: 0 0 0 1px #ccc;' : ''}"
										title={c.label}
									></button>
								{/each}
							</div>
						</div>

						<!-- Color fondo -->
						<div>
							<label class="label-field">Color del fondo</label>
							<div class="sim-swatch-row">
								{#each NEON_FONDOS as f}
									<button
										onclick={() => (simFondo = f.hex)}
										class="sim-swatch"
										class:sim-swatch-active={simFondo === f.hex}
										style="background: {f.hex}; {f.hex === '#ffffff' || f.hex === '#0a0a0a' || f.hex === '#1a1a1a' ? 'box-shadow: 0 0 0 1px #555;' : ''}"
										title={f.label}
									></button>
								{/each}
							</div>
						</div>

						<!-- Alineación -->
						<div>
							<label class="label-field">Alineación</label>
							<div class="sim-align-row">
								{#each [
									{ val: 'left', icon: '⬅' },
									{ val: 'center', icon: '↔' },
									{ val: 'right', icon: '➡' }
								] as a}
									<button
										onclick={() => (simAlign = a.val as 'left' | 'center' | 'right')}
										class="sim-align-btn"
										class:sim-align-active={simAlign === a.val}
									>{a.icon}</button>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">💡</div>
						<div class="sc-texts">
							<h3 class="sc-title">Neon Flex</h3>
							<p class="sc-desc">Dimensiones y características</p>
						</div>
					</div>
					<div class="sc-content">
						<div>
							<label class="label-field">Tamaño</label>
							<div class="grid grid-cols-2 gap-2">
								{#each [
									{ val: 'small', label: 'Pequeño', sub: ((data.parametros.neon as any)?.small?.medida ?? '').replace(/(?:×|├ù)/gi, ' X ').replace(/ +X +/g, ' X ').trim() },
									{ val: 'medium', label: 'Mediano', sub: ((data.parametros.neon as any)?.medium?.medida ?? '').replace(/(?:×|├ù)/gi, ' X ').replace(/ +X +/g, ' X ').trim() },
									{ val: 'large', label: 'Grande', sub: ((data.parametros.neon as any)?.large?.medida ?? '').replace(/(?:×|├ù)/gi, ' X ').replace(/ +X +/g, ' X ').trim() },
									{ val: 'custom', label: 'Tamaño personalizado', sub: 'Ingresar medidas del acrílico' }
								] as opt}
									<button
										onclick={() => (neon.tamano = opt.val as 'small' | 'medium' | 'large' | 'custom')}
										class="size-btn rounded-lg p-3 text-center transition-colors"
										class:size-activo={neon.tamano === opt.val}
									>
										<span class="block text-sm font-medium">{opt.label}</span>
										<span class="block text-[10px] text-[var(--text-dim)]">{opt.sub}</span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Campos del tamaño personalizado -->
						{#if neon.tamano === 'custom'}
							<div class="mt-4 border-t border-[var(--border)] pt-4 space-y-4">
								<!-- Medidas -->
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="label-field">Ancho acrílico (cm)</label>
										<input type="number" bind:value={neon.custom_ancho_cm} min="1" class="input-calc" placeholder="Ej: 60" />
									</div>
									<div>
										<label class="label-field">Alto acrílico (cm)</label>
										<input type="number" bind:value={neon.custom_alto_cm} min="1" class="input-calc" placeholder="Ej: 40" />
									</div>
								</div>

								<!-- Grosor del acrílico -->
								<div>
									<label class="label-field">Grosor del acrílico</label>
									<div class="grid grid-cols-2 gap-2 mt-1">
										<button
											onclick={() => (neon.custom_grosor = '3mm')}
											class="size-btn rounded-lg p-3 text-center transition-colors"
											class:size-activo={neon.custom_grosor === '3mm'}
										>
											<span class="block text-sm font-medium">Acrílico 3mm</span>
											<span class="block text-[10px] text-[var(--text-dim)]">$45 por cm²</span>
										</button>
										<button
											onclick={() => (neon.custom_grosor = '6mm')}
											class="size-btn rounded-lg p-3 text-center transition-colors"
											class:size-activo={neon.custom_grosor === '6mm'}
										>
											<span class="block text-sm font-medium">Acrílico 6mm</span>
											<span class="block text-[10px] text-[var(--text-dim)]">$60 por cm²</span>
										</button>
									</div>
								</div>

								<!-- Vinilo -->
								<div class="border-t border-[var(--border)] pt-3">
									<label class="toggle-row-between">
										<div class="toggle-label-group">
											<span class="toggle-label-main">¿Lleva vinilo?</span>
											<span class="toggle-label-sub">Costos por metro cuadrado</span>
										</div>
										<input type="checkbox" bind:checked={neon.custom_con_vinilo} class="toggle-check" />
									</label>
									{#if neon.custom_con_vinilo}
										<div class="grid grid-cols-2 gap-3 mt-3">
											<div>
												<label class="label-field">Ancho vinilo (cm)</label>
												<input type="number" bind:value={neon.custom_vinilo_ancho_cm} min="1" class="input-calc" />
											</div>
											<div>
												<label class="label-field">Alto vinilo (cm)</label>
												<input type="number" bind:value={neon.custom_vinilo_alto_cm} min="1" class="input-calc" />
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>

				{#if neon.tamano !== 'custom'}
					<div class="section-card">
						<div class="sc-header">
							<div class="sc-icon">🔧</div>
							<div class="sc-texts">
								<h3 class="sc-title">Instalación</h3>
								<p class="sc-desc">Montaje en el lugar indicado</p>
							</div>
						</div>
						<div class="sc-content">
							<label class="toggle-row-between">
								<div class="toggle-label-group">
									<span class="toggle-label-main">¿Con instalación?</span>
									<span class="toggle-label-sub">Incluye extras de instalación</span>
								</div>
								<input type="checkbox" bind:checked={neon.con_instalacion} class="toggle-check" />
							</label>
						</div>
					</div>
				{/if}

			{:else if tabActiva === 'vinilo'}
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🖼️</div>
						<div class="sc-texts">
							<h3 class="sc-title">Trozos de Vinilo</h3>
							<p class="sc-desc">Medidas por piezas (en centímetros)</p>
						</div>
					</div>
					<div class="sc-content">
						<div>
							<label class="label-field">¿Cuántos pedazos requieres?</label>
							<input type="number" bind:value={vinilo.cantidad_pedazos} min="1" max="50" class="input-calc" placeholder="Ej: 1" />
						</div>

						{#if vinilo.pedazos.length > 0}
							<div class="space-y-3 rounded-lg bg-[#080808] border border-[var(--border)] p-4">
								{#each vinilo.pedazos as p, idx}
									<div class="space-y-2 {idx > 0 ? 'border-t border-[var(--border)] pt-3' : ''}">
										<div class="flex items-center gap-2">
											<span class="w-6 text-center text-xs font-semibold text-[var(--text-dim)]">{idx + 1}</span>
											<span class="text-sm font-medium text-[var(--text)]">Pieza {idx + 1}</span>
										</div>
										<div class="flex items-center gap-2 pl-8">
											<div class="flex-1">
												<label class="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1 block">Ancho (cm)</label>
												<input type="number" bind:value={p.ancho_cm} min="1" step="1" class="input-calc w-full bg-[#121212] border-0" placeholder="Ancho" />
											</div>
											<span class="text-[10px] text-[var(--text-dim)] translate-y-3">X</span>
											<div class="flex-1">
												<label class="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1 block">Alto (cm)</label>
												<input type="number" bind:value={p.alto_cm} min="1" step="1" class="input-calc w-full bg-[#121212] border-0" placeholder="Alto" />
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">🔧</div>
						<div class="sc-texts">
							<h3 class="sc-title">Instalación</h3>
							<p class="sc-desc">Montaje en superficie</p>
						</div>
					</div>
					<div class="sc-content">
						<label class="toggle-row-between">
							<div class="toggle-label-group">
								<span class="toggle-label-main">¿Con instalación?</span>
								<span class="toggle-label-sub">Instalación {data.parametros.vinilo ? `gratis desde ${(data.parametros.vinilo as any).gratis_desde_m2} m²` : ''}</span>
							</div>
							<input type="checkbox" bind:checked={vinilo.con_instalacion} class="toggle-check" />
						</label>
					</div>
				</div>

			{:else if tabActiva === 'acrilio'}
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">📏</div>
						<div class="sc-texts">
							<h3 class="sc-title">Medidas Superficie</h3>
							<p class="sc-desc">Ancho y alto en centímetros</p>
						</div>
					</div>
					<div class="sc-content">
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
						<div class="grid grid-cols-2 gap-4 mt-6 border-t border-[var(--border)] pt-4">
							<label class="toggle-row-between">
								<div class="toggle-label-group">
									<span class="toggle-label-main">¿Lleva LED?</span>
									<span class="toggle-label-sub">Iluminación perimetral</span>
								</div>
								<input type="checkbox" bind:checked={acrilio.con_iluminacion} class="toggle-check" />
							</label>
							<label class="toggle-row-between">
								<div class="toggle-label-group">
									<span class="toggle-label-main">¿Microporosa?</span>
									<span class="toggle-label-sub">Soporte trasero extra</span>
								</div>
								<input type="checkbox" bind:checked={acrilio.con_microporosa} class="toggle-check" />
							</label>
						</div>
					</div>
				</div>

			{:else if tabActiva === 'acrilio_circular'}
				<div class="section-card">
					<div class="sc-header">
						<div class="sc-icon">⚪</div>
						<div class="sc-texts">
							<h3 class="sc-title">Diámetro de Circunferencia</h3>
							<p class="sc-desc">Diámetros fijos soportados</p>
						</div>
					</div>
					<div class="sc-content">
						<div class="grid grid-cols-5 gap-2">
							{#each ['d40', 'd50', 'd60', 'd70', 'd80'] as d}
								<button
									onclick={() => (acrilioCircular.diametro = d as any)}
									class="size-btn rounded-lg p-3 text-center transition-colors"
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
		<div class="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24 self-start w-full">
			<div class="modern-card relative overflow-hidden">
				<div class="card-header mb-4 relative z-10">
					<div class="card-icon">💰</div>
					<div>
						<h2 class="card-title font-rajdhani">Cotización</h2>
						<p class="card-desc">Cálculo de precio y costos</p>
					</div>
				</div>

				{#if !resultado}
					<p class="py-8 text-center text-sm text-[var(--text-dim)] relative z-10">
						No hay parámetros configurados para este producto.
						<a href="/configuracion/catalogo" class="text-[var(--brand-light)] hover:underline">Configurar</a>
					</p>
				{:else}
					<div class="resumen-box relative z-10">
						{#each resultado.desglose as linea}
							<div class="resumen-item">
								<span class="nombre">{linea.concepto}</span>
								<span class="valor">{fmt(linea.valor)}</span>
							</div>
						{/each}
						
						<div class="resumen-subtotales mt-3 pt-3">
							<div class="resumen-item fabricacion">
								<span class="nombre">Costo de fabricación</span>
								<span class="valor">{fmt(resultado.costoFabricacion)}</span>
							</div>
							{#if resultado.margen > 0}
								<div class="resumen-item ganancia">
									<span class="nombre">Ganancia ({Math.round(resultado.margen * 100)}%)</span>
									<span class="valor">+{fmt(resultado.precioCliente - resultado.costoFabricacion)}</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="precio-cliente-panel mt-5 relative z-10">
						<div class="pc-label font-rajdhani">Valor del aviso</div>
						<div class="pc-monto font-rajdhani">{fmt(resultado.precioCliente)}</div>
						
						<button
							onclick={agregarAlCarrito}
							class="btn-modern w-full"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
							Agregar al carrito
						</button>
					</div>
				{/if}
			</div>
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
	:global(.font-exo) { font-family: 'Exo 2', sans-serif; }
	:global(.font-rajdhani) { font-family: 'Rajdhani', sans-serif; }

	.calculator-root {
		max-width: 1300px;
		margin: 0 auto;
		color: var(--text);
	}

	.hero-header {
		text-align: center;
		padding: 24px 0 40px;
		position: relative;
	}
	.title-glow {
		font-size: clamp(2rem, 4vw, 2.8rem);
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
		text-shadow: 0 0 24px rgba(255, 255, 255, 0.2);
	}
	.subtitle {
		font-size: 0.95rem;
		color: var(--text-muted);
		font-weight: 300;
	}

	/* Tarjetas modernas */
	.modern-card {
		background: #0a0a0a;
		border: 1px solid #222222;
		border-radius: 16px;
		padding: 24px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.4);
		transition: border-color 0.3s, box-shadow 0.3s;
	}
	.modern-card:hover { border-color: #333333; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }

	.card-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.card-icon {
		width: 44px; height: 44px;
		border-radius: 10px;
		background: #141414;
		border: 1px solid #2a2a2a;
		display: flex; align-items: center; justify-content: center;
		font-size: 1.3rem;
		flex-shrink: 0;
	}
	.card-title { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.3px; color: #ffffff; }
	.card-desc  { font-size: 0.8rem; color: var(--text-muted); font-weight: 400; margin-top: 2px; }

	/* Selector de tipo */
	.tipo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
	}
	@media (max-width: 640px) { .tipo-grid { grid-template-columns: 1fr 1fr; } }
	
	.tipo-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 16px 10px;
		border: 1.5px solid #222;
		border-radius: 12px;
		background: #0d0d0d;
		cursor: pointer;
		text-align: center;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.tipo-btn:hover { border-color: #444; background: #141414; transform: translateY(-2px); }
	.tipo-btn.active {
		border-color: rgba(255,255,255,0.6);
		background: #181818;
		box-shadow: 0 0 0 3px rgba(255,255,255,0.06), 0 0 20px rgba(255,255,255,0.1);
	}
	.tipo-icon { font-size: 1.8rem; line-height: 1; margin-bottom: 4px; }
	.tipo-nombre { font-size: 0.95rem; font-weight: 700; color: #fff; letter-spacing: 0.4px; }
	.tipo-hint { font-size: 0.72rem; color: var(--text-muted); font-weight: 400; line-height: 1.2; }

	/* Inputs y elementos de formulario */
	.label-field {
		display: block;
		margin-bottom: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(255,255,255,0.75);
		letter-spacing: 0.2px;
	}
	.input-calc {
		width: 100%;
		border-radius: 8px;
		border: 1px solid #333;
		background: #0d0d0d;
		padding: 10px 14px;
		font-size: 0.95rem;
		color: #fff;
		outline: none;
		transition: all 0.2s;
	}
	.input-calc:focus {
		border-color: rgba(255,255,255,0.5);
		box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
		background: #141414;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
		padding: 4px 0;
	}
	.toggle-check {
		appearance: none;
		width: 44px; height: 24px;
		background: #2a2a2a;
		border-radius: 50px;
		position: relative;
		cursor: pointer;
		outline: none;
		border: 1px solid #444;
		transition: background 0.3s;
	}
	.toggle-check::after {
		content: '';
		position: absolute;
		top: 2px; left: 2px;
		width: 18px; height: 18px;
		background: #888;
		border-radius: 50%;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;
	}
	.toggle-check:checked { background: #1a1a1a; border-color: rgba(255,255,255,0.5); }
	.toggle-check:checked::after { transform: translateX(20px); background: #fff; }

	.size-btn {
		border-color: #2a2a2a;
		color: var(--text-muted);
		background: #0d0d0d;
		border-width: 1.5px;
	}
	.size-btn:hover { border-color: #444; color: #fff; background: #141414; }
	.size-activo {
		border-color: rgba(255,255,255,0.5) !important;
		color: #fff !important;
		background: #181818 !important;
		box-shadow: 0 0 16px rgba(255,255,255,0.08) !important;
	}

	/* Panel de Precio */
	.resumen-box {
		background: #080808;
		border: 1px solid #1a1a1a;
		border-radius: 12px;
		padding: 16px 20px;
	}
	.resumen-item {
		display: flex;
		justify-content: space-between;
		padding: 6px 0;
		font-size: 0.88rem;
		border-bottom: 1px solid #141414;
	}
	.resumen-item:last-child { border-bottom: none; }
	.resumen-item .nombre { color: var(--text-muted); }
	.resumen-item .valor { font-weight: 600; color: #eee; }
	.resumen-subtotales { border-top: 1px dashed #2a2a2a; }
	.resumen-item.ganancia .valor { color: var(--success); font-weight: 700; }

	.precio-cliente-panel {
		background: #080808;
		border: 1px solid rgba(255,255,255,0.15);
		border-radius: 14px;
		padding: 32px 24px;
		text-align: center;
		box-shadow: 0 0 40px rgba(0,0,0,0.5);
		position: relative;
		overflow: hidden;
	}
	.precio-cliente-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle at center, rgba(255,255,255,0.03) 1px, transparent 1px);
		background-size: 24px 24px;
		pointer-events: none;
	}
	.pc-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 3px;
		color: rgba(255,255,255,0.5);
		margin-bottom: 8px;
		position: relative;
	}
	.pc-monto {
		font-size: clamp(2.5rem, 6vw, 3.2rem);
		font-weight: 700;
		color: #fff;
		margin-bottom: 24px;
		text-shadow: 0 0 30px rgba(255,255,255,0.2);
		line-height: 1.1;
		position: relative;
	}

	.btn-modern {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: #ffffff;
		color: #000;
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.5px;
		padding: 14px 24px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 0 20px rgba(255,255,255,0.15);
		position: relative;
	}
	.btn-modern:hover {
		transform: translateY(-2px);
		box-shadow: 0 0 30px rgba(255,255,255,0.25);
		background: #f0f0f0;
	}
	.btn-modern:active { transform: scale(0.98); }

	/* Section Cards para Inputs Divididos */
	.section-card {
		background: #0d0d0d;
		border: 1px solid #1a1a1a;
		border-radius: 14px;
		padding: 20px;
		transition: border-color 0.2s;
	}
	.section-card:hover {
		border-color: #2a2a2a;
	}
	.sc-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}
	.sc-icon {
		width: 38px; height: 38px;
		background: #141414;
		border: 1px solid #222;
		border-radius: 10px;
		display: flex; align-items: center; justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
	}
	.sc-texts { display: flex; flex-direction: column; }
	.sc-title { font-size: 0.95rem; font-weight: 700; color: #fff; letter-spacing: 0.2px; }
	.sc-desc { font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; }
	.sc-content {
		display: flex; flex-direction: column; gap: 16px;
	}

	.toggle-row-between {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}
	.toggle-label-group {
		display: flex;
		flex-direction: column;
	}
	.toggle-label-main {
		font-size: 0.85rem;
		font-weight: 600;
		color: #eee;
	}
	.toggle-label-sub {
		font-size: 0.75rem;
		color: var(--text-dim);
		margin-top: 3px;
	}

	/* ── Simulador Neon ──────────────────────────────── */
	.sim-preview-box {
		border-radius: 14px;
		min-height: 320px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 64px 48px;
		position: relative;
		overflow: hidden;
		transition: background 0.3s;
	}

	.sim-acrylic {
		display: inline-block;
		filter: url(#neon-acrylic-filter);
		max-width: 100%;
	}

	.sim-neon-text {
		text-align: center;
		word-break: break-word;
		overflow-wrap: break-word;
		max-width: 100%;
		line-height: 1.3;
		color: #fff;
		transition: color 0.2s, font-family 0.2s, text-shadow 0.3s;
		animation: nflicker 6s infinite;
		max-width: 100%;
	}

	@keyframes nflicker {
		0%,94%,96%,98%,100% { opacity: 1; }
		95%  { opacity: .85; }
		97%  { opacity: .7; }
		99%  { opacity: .9; }
	}

	/* Fuentes pills */
	.sim-font-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}
	.sim-font-pill {
		padding: 6px 14px;
		border-radius: 50px;
		border: 1.5px solid #222;
		background: #111;
		color: #ccc;
		cursor: pointer;
		font-size: 0.9rem;
		transition: border-color 0.15s, background 0.15s;
	}
	.sim-font-pill:hover { border-color: #444; background: #181818; }
	.sim-font-active {
		border-color: rgba(255,255,255,0.5) !important;
		background: #1a1a1a !important;
		color: #fff !important;
		font-weight: 700;
	}

	/* Swatches de color */
	.sim-swatch-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 6px;
	}
	.sim-swatch {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		cursor: pointer;
		border: 3px solid transparent;
		transition: transform 0.15s, border-color 0.15s;
	}
	.sim-swatch:hover { transform: scale(1.15); }
	.sim-swatch-active {
		border-color: #fff !important;
		transform: scale(1.15);
	}

	/* Slider de tamaño */
	.sim-size-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: #2a2a2a;
		outline: none;
		cursor: pointer;
	}
	.sim-size-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		box-shadow: 0 0 6px rgba(255,255,255,0.4);
	}
	.sim-size-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		border: none;
		box-shadow: 0 0 6px rgba(255,255,255,0.4);
	}

	/* Alineación */
	.sim-align-row {
		display: flex;
		gap: 8px;
		margin-top: 6px;
	}
	.sim-align-btn {
		flex: 1;
		padding: 8px;
		border: 1.5px solid #1e1e1e;
		border-radius: 8px;
		background: #0d0d0d;
		color: #ccc;
		font-size: 1.1rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.sim-align-btn:hover { border-color: #383838; background: #141414; }
	.sim-align-active {
		border-color: rgba(255,255,255,0.4) !important;
		background: #141414 !important;
	}
</style>
