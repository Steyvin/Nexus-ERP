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
	faja_grosor_custom: boolean    // true = elegir grosor de faja manualmente
	faja_ancho_cm: number          // grosor/ancho de la faja (default 6 cm)
	con_vinilo: boolean
	vinilo_ancho_cm: number
	vinilo_alto_cm: number
	con_estructura: boolean
	estructura_personalizada: number // 0 = usar cálculo automático
	mdo_personalizada: boolean       // true = ingresar mano de obra manual
	mdo_custom: number               // valor manual de mano de obra
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

	// 3. Faja / cantonera (perímetro × ancho_faja × precio/cm²)
	const perimetro =
		i.perimetro_manual > 0
			? i.perimetro_manual
			: i.ancho_cm * 2 + i.alto_cm * 2
	const anchoFaja = i.faja_ancho_cm > 0 ? i.faja_ancho_cm : 6
	const areaFaja = perimetro * anchoFaja
	desglose.push({
		concepto: `Faja (${perimetro}×${anchoFaja} cm = ${areaFaja} cm²)`,
		valor: areaFaja * p.precio_faja_cm2
	})

	// Tapa PVC (base)
	const areaCm2Base = i.ancho_cm * i.alto_cm;
	if (p.precio_cm2_pvc > 0 && areaCm2Base > 0) {
		desglose.push({
			concepto: `Tapa PVC (${areaCm2Base} cm²)`,
			valor: areaCm2Base * p.precio_cm2_pvc
		})
	}

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

	// 7. Mano de obra (automática por tamaño o personalizada)
	{
		let valorMdo: number
		if (i.mdo_personalizada && i.mdo_custom > 0) {
			valorMdo = i.mdo_custom
		} else {
			const maxDim = Math.max(i.ancho_cm, i.alto_cm)
			if (maxDim <= 80) valorMdo = p.mdo_pequena
			else if (maxDim <= 120) valorMdo = p.mdo_mediana
			else valorMdo = p.mdo_grande
		}
		desglose.push({ concepto: 'Mano de obra', valor: valorMdo })
	}

	// 8. Transporte (automático por tamaño)
	if (i.con_transporte) {
		const maxDim = Math.max(i.ancho_cm, i.alto_cm)
		const valorTransporte = maxDim > 80 ? p.transporte_grande : p.transporte_pequeno
		desglose.push({ concepto: 'Transporte', valor: valorTransporte })
	}

	// Totales: ganancia sobre el precio de venta (profit margin)
	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	const precioExacto = p.margen_ganancia < 1 ? costoFabricacion / (1 - p.margen_ganancia) : costoFabricacion
	const precioCliente = Math.ceil(precioExacto / 1000) * 1000

	return {
		desglose,
		costoFabricacion,
		precioCliente,
		margen: p.margen_ganancia
	}
}

// ─── Letra por Letra ─────────────────────────────────────────────────────────

export interface InputLetra {
	ancho_cm: number
	alto_cm: number
	perimetro_cm: number
	faja_grosor_custom: boolean
	faja_ancho_cm: number
	apliques: ApliqueNube[]
	con_estructura: boolean
	estructura_personalizada: number
	mdo_personalizada: boolean
	mdo_custom: number
	con_transporte: boolean
	con_vinilo: boolean
	vinilo_ancho_cm: number
	vinilo_alto_cm: number
}

export function calcularLetra(i: InputLetra, p: ParametrosLetra): ResultadoCalculo {
	const desglose: LineaDesglose[] = []
	const areaCm2 = i.ancho_cm * i.alto_cm

	// 1. Tapa Acrílico (Base imaginaria de todas las letras juntas)
	if (areaCm2 > 0) {
		desglose.push({
			concepto: `Acrílico (Bounding Box) (${areaCm2} cm²)`,
			valor: areaCm2 * p.precio_cm2_acrilico
		})
	}

	// 2. Tapa PVC 
	if (areaCm2 > 0 && p.precio_cm2_pvc > 0) {
		desglose.push({
			concepto: `Tapa PVC (${areaCm2} cm²)`,
			valor: areaCm2 * p.precio_cm2_pvc
		})
	}

	// 3. Apliques
	i.apliques.forEach((ap, idx) => {
		const ap_area = ap.ancho_cm * ap.alto_cm
		if (ap_area > 0) {
			const pr = esColorPremium(ap.color) ? p.precio_cm2_acrilico_premium : p.precio_cm2_acrilico
			const sub = ap_area * pr
			desglose.push({ concepto: `Aplique ${idx + 1} (${ap.color})`, valor: sub })
		}
	})

	// 4. Faja perimetral (Usando el perímetro_m sumado manualmente)
	if (i.perimetro_cm > 0) {
		const anchoFaja = i.faja_ancho_cm > 0 ? i.faja_ancho_cm : 6
		// Dividir tiras por 120cm y aproximar al siguiente entero
		const numFajas = Math.ceil(i.perimetro_cm / 120)
		// Fórmula: fajas * grosor * coeficiente
		const areaCoeficiente = numFajas * anchoFaja
		desglose.push({
			concepto: `Faja perimetral (${i.faja_ancho_cm} cm de ancho)`,
			valor: areaCoeficiente * p.precio_faja_cm2
		})
	}

	// 5. LED directo por perímetro 
	if (i.perimetro_cm > 0) {
		// La luz se calcula con la mitad del perímetro en metros
		const luz_metros = (i.perimetro_cm / 100) / 2
		desglose.push({
			concepto: `LED perimetral (${luz_metros.toFixed(2)} m)`,
			valor: luz_metros * p.precio_led_m
		})
	}

	// 6. Vinilo
	if (i.con_vinilo && i.vinilo_ancho_cm > 0 && i.vinilo_alto_cm > 0) {
		const area_vinilo_m2 = (i.vinilo_ancho_cm * i.vinilo_alto_cm) / 10000
		desglose.push({
			concepto: `Vinilo (${area_vinilo_m2.toFixed(2)} m²)`,
			valor: area_vinilo_m2 * p.precio_vinilo_m2
		})
	}

	// 7. Estructura
	if (i.con_estructura) {
		let valorEstructura = 0
		if (i.estructura_personalizada > 0) {
			valorEstructura = i.estructura_personalizada
		} else {
			const max_dim = Math.max(i.ancho_cm, i.alto_cm)
			if (max_dim <= 100) valorEstructura = p.estructura_pequena
			else if (max_dim <= 140) valorEstructura = p.estructura_mediana
			else valorEstructura = p.estructura_grande
		}
		desglose.push({ concepto: 'Estructura', valor: valorEstructura })
	}

	// 8. Mano de Obra
	{
		let valorMdo = 0
		if (i.mdo_personalizada && i.mdo_custom > 0) {
			valorMdo = i.mdo_custom
		} else {
			const max_dim = Math.max(i.ancho_cm, i.alto_cm)
			if (max_dim <= 80) valorMdo = p.mdo_pequena
			else if (max_dim <= 120) valorMdo = p.mdo_mediana
			else valorMdo = p.mdo_grande
		}
		desglose.push({ concepto: 'Mano de Obra', valor: valorMdo })
	}

	// 9. Transporte
	if (i.con_transporte) {
		const max_dim = Math.max(i.ancho_cm, i.alto_cm)
		const valorTransporte = max_dim > 80 ? p.transporte_grande : p.transporte_pequeno
		desglose.push({ concepto: 'Transporte', valor: valorTransporte })
	}

	const costoFabricacion = desglose.reduce((s, l) => s + l.valor, 0)
	const precioExacto = p.margen_ganancia < 1 ? costoFabricacion / (1 - p.margen_ganancia) : costoFabricacion
	const precioCliente = Math.ceil(precioExacto / 1000) * 1000

	return { desglose, costoFabricacion, precioCliente, margen: p.margen_ganancia }
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
