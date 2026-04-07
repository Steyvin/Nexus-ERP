import type {
	ParametrosNube,
	ParametrosLetra,
	ParametrosNeon,
	ParametrosVinilo,
	ParametrosAcrilio,
	ParametrosAcrilioCircular
} from '$lib/types'

// ─── Tipos de resultado ──────────────────────────────────────────────────────

export interface LineaDesglose {
	concepto: string
	valor: number
}

export interface ResultadoCalculo {
	desglose: LineaDesglose[]
	costoFabricacion: number
	precioCliente: number
	margen: number
}

function resultado(desglose: LineaDesglose[], margen: number): ResultadoCalculo {
	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	const precioCliente = margen < 1 ? costoFabricacion / (1 - margen) : costoFabricacion
	return { desglose, costoFabricacion, precioCliente, margen }
}

// ─── Nube / Aviso con faja ───────────────────────────────────────────────────

export const COLORES_NORMALES = [
	'Rojo', 'Verde', 'Negro', 'Blanco', 'Rosado', 'Amarillo', 'Naranja', 'Morado', 'Azul', 'Aguamarina'
] as const

export const COLORES_PREMIUM = ['Dorado', 'Plateado', 'Oro Rosa'] as const

export const TODOS_COLORES = [...COLORES_NORMALES, ...COLORES_PREMIUM] as const

export type ColorAplique = (typeof TODOS_COLORES)[number]

export function esColorPremium(color: ColorAplique): boolean {
	return (COLORES_PREMIUM as readonly string[]).includes(color)
}

export interface ApliqueNube {
	color: ColorAplique
	ancho_cm: number
	alto_cm: number
}

export interface InputNube {
	ancho_cm: number
	alto_cm: number
	cantidad_apliques: number
	apliques: ApliqueNube[]
	perimetro_manual: number       // 0 = calcular automáticamente
	con_vinilo: boolean
	vinilo_ancho_cm: number
	vinilo_alto_cm: number
	con_estructura: boolean
	estructura_personalizada: number // 0 = usar cálculo automático
	con_transporte: boolean
}

export function calcularNube(i: InputNube, p: ParametrosNube): ResultadoCalculo {
	const desglose: LineaDesglose[] = []

	// 1. Tapa acrílico (área del aviso × $15/cm²)
	const areaTapa = i.ancho_cm * i.alto_cm
	desglose.push({
		concepto: `Tapa acrílico (${i.ancho_cm}×${i.alto_cm} cm)`,
		valor: areaTapa * p.precio_cm2_acrilico
	})

	// 2. Apliques de acrílico (cada uno con color, medidas y precio según color)
	if (i.apliques.length > 0) {
		let totalApliques = 0
		for (const ap of i.apliques) {
			const precioCm2 = esColorPremium(ap.color)
				? p.precio_cm2_acrilico_premium
				: p.precio_cm2_acrilico
			totalApliques += ap.ancho_cm * ap.alto_cm * precioCm2
		}
		desglose.push({
			concepto: `Apliques acrílico (${i.apliques.length})`,
			valor: totalApliques
		})
	}

	// 3. Faja / cantonera (perímetro × alto_faja × $15/cm²)
	//    El perímetro se calcula como área de la faja: perímetro_lineal × alto_aviso
	//    Pero según la lógica indicada: perímetro (cm) × precio por cm²
	//    La faja tiene un ancho (el grosor del aviso), aquí usamos el perímetro × precio_faja_cm2
	const perimetro =
		i.perimetro_manual > 0
			? i.perimetro_manual
			: i.ancho_cm * 2 + i.alto_cm * 2
	desglose.push({
		concepto: `Faja (${perimetro} cm perímetro)`,
		valor: perimetro * p.precio_faja_cm2
	})

	// 4. LED serpentina (separación fija, pasadas × ancho → metros)
	const pasadas = Math.floor(i.alto_cm / p.separacion_led_cm)
	const largoLedCm = pasadas * i.ancho_cm
	const largoLedM = largoLedCm / 100
	desglose.push({
		concepto: `LED serpentina (${pasadas} pasadas, ${largoLedM.toFixed(2)} m)`,
		valor: largoLedM * p.precio_led_m
	})

	// 5. Vinilo (opcional, con sus propias medidas)
	if (i.con_vinilo && i.vinilo_ancho_cm > 0 && i.vinilo_alto_cm > 0) {
		const areaM2 = (i.vinilo_ancho_cm * i.vinilo_alto_cm) / 10000
		desglose.push({
			concepto: `Vinilo (${i.vinilo_ancho_cm}×${i.vinilo_alto_cm} cm = ${areaM2.toFixed(2)} m²)`,
			valor: areaM2 * p.precio_vinilo_m2
		})
	}

	// 6. Estructura (automática por tamaño o personalizada)
	if (i.con_estructura) {
		let valorEstructura: number
		if (i.estructura_personalizada > 0) {
			valorEstructura = i.estructura_personalizada
		} else {
			const maxDim = Math.max(i.ancho_cm, i.alto_cm)
			if (maxDim <= 100) valorEstructura = p.estructura_pequena
			else if (maxDim <= 140) valorEstructura = p.estructura_mediana
			else valorEstructura = p.estructura_grande
		}
		desglose.push({ concepto: 'Estructura', valor: valorEstructura })
	}

	// 7. Transporte (automático por tamaño)
	if (i.con_transporte) {
		const maxDim = Math.max(i.ancho_cm, i.alto_cm)
		const valorTransporte = maxDim > 80 ? p.transporte_grande : p.transporte_pequeno
		desglose.push({ concepto: 'Transporte', valor: valorTransporte })
	}

	// Totales: ganancia = 40% sobre costo → precio = costo × 1.40, redondeado a miles
	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	const ganancia = costoFabricacion * p.margen_ganancia
	const precioCliente = Math.ceil((costoFabricacion + ganancia) / 1000) * 1000

	return {
		desglose,
		costoFabricacion,
		precioCliente,
		margen: p.margen_ganancia
	}
}

// ─── Letra por Letra ─────────────────────────────────────────────────────────

export interface InputLetra {
	perimetro_cm: number
	cantidad_letras: number
}

export function calcularLetra(i: InputLetra, p: ParametrosLetra): ResultadoCalculo {
	const desglose: LineaDesglose[] = []

	// LED directo por perímetro
	const perimetro_m = i.perimetro_cm / 100
	desglose.push({
		concepto: 'LED directo',
		valor: perimetro_m * p.precio_led_m
	})

	// Mano de obra por letra
	desglose.push({
		concepto: `Mano de obra (${i.cantidad_letras} letras)`,
		valor: i.cantidad_letras * p.mdo_por_letra
	})

	return resultado(desglose, p.margen_ganancia)
}

// ─── Neon Flex ───────────────────────────────────────────────────────────────

export interface InputNeon {
	tamano: 'small' | 'medium' | 'large'
	con_instalacion: boolean
}

export function calcularNeon(i: InputNeon, p: ParametrosNeon): ResultadoCalculo {
	const tier = p[i.tamano]
	const desglose: LineaDesglose[] = []

	desglose.push({
		concepto: `Neon ${i.tamano === 'small' ? 'Pequeño' : i.tamano === 'medium' ? 'Mediano' : 'Grande'} (${tier.medida})`,
		valor: tier.precio
	})

	if (i.con_instalacion) {
		desglose.push({ concepto: 'Instalación', valor: p.instalacion })
	}

	// Neon tiene precios fijos (margen ya incluido)
	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	return { desglose, costoFabricacion, precioCliente: costoFabricacion, margen: 0 }
}

// ─── Vinilo ──────────────────────────────────────────────────────────────────

export interface InputVinilo {
	ancho_m: number
	alto_m: number
	con_instalacion: boolean
}

export function calcularVinilo(i: InputVinilo, p: ParametrosVinilo): ResultadoCalculo {
	const area_m2 = i.ancho_m * i.alto_m
	const desglose: LineaDesglose[] = []

	desglose.push({
		concepto: `Vinilo (${area_m2.toFixed(2)} m²)`,
		valor: area_m2 * p.precio_m2
	})

	if (i.con_instalacion && area_m2 < p.gratis_desde_m2) {
		desglose.push({ concepto: 'Instalación', valor: p.instalacion })
	} else if (i.con_instalacion) {
		desglose.push({ concepto: 'Instalación (gratis desde ' + p.gratis_desde_m2 + ' m²)', valor: 0 })
	}

	// Vinilo tiene precios fijos
	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	return { desglose, costoFabricacion, precioCliente: costoFabricacion, margen: 0 }
}

// ─── Acrílico sin faja ──────────────────────────────────────────────────────

export interface InputAcrilio {
	ancho_cm: number
	alto_cm: number
}

export function calcularAcrilio(i: InputAcrilio, p: ParametrosAcrilio): ResultadoCalculo {
	const desglose: LineaDesglose[] = []

	// Base acrílico
	desglose.push({
		concepto: 'Base acrílico',
		valor: i.ancho_cm * i.alto_cm * p.precio_cm2_acrilico
	})

	// Apliques
	const apliques = p.precio_apliques ?? 0
	if (apliques > 0) desglose.push({ concepto: 'Apliques', valor: apliques })

	// LED perímetro
	const perimetro_m = (2 * (i.ancho_cm + i.alto_cm)) / 100
	desglose.push({
		concepto: 'LED perímetro',
		valor: perimetro_m * p.precio_led_m_perimetro
	})

	return resultado(desglose, p.margen_ganancia)
}

// ─── Acrílico Circular ──────────────────────────────────────────────────────

export interface InputAcrilioCircular {
	diametro: 'd40' | 'd50' | 'd60' | 'd70' | 'd80'
}

const DIAMETRO_LABEL: Record<string, string> = {
	d40: '40 cm',
	d50: '50 cm',
	d60: '60 cm',
	d70: '70 cm',
	d80: '80 cm'
}

export function calcularAcrilioCircular(
	i: InputAcrilioCircular,
	p: ParametrosAcrilioCircular
): ResultadoCalculo {
	const precio = p[i.diametro]
	const desglose: LineaDesglose[] = [
		{ concepto: `Acrílico circular ${DIAMETRO_LABEL[i.diametro]}`, valor: precio }
	]

	// Precios fijos
	return { desglose, costoFabricacion: precio, precioCliente: precio, margen: 0 }
}
