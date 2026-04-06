// Formatea número como moneda COP: $1.250.000
export function fmt(valor: number): string {
	if (!valor && valor !== 0) return '$0'
	return '$' + Math.round(valor).toLocaleString('es-CO')
}

// Formatea fecha ISO a texto legible: "2 abr 2026"
export function fmtFecha(iso: string | null | undefined): string {
	if (!iso) return '—'
	return new Date(iso).toLocaleDateString('es-CO', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	})
}

// Formatea fecha relativa: "hace 2 días"
export function fmtRelativa(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime()
	const min  = Math.floor(diff / 60000)
	const hrs  = Math.floor(diff / 3600000)
	const dias = Math.floor(diff / 86400000)
	if (min < 1)  return 'ahora mismo'
	if (min < 60) return `hace ${min} min`
	if (hrs < 24) return `hace ${hrs} h`
	if (dias < 7) return `hace ${dias} día${dias > 1 ? 's' : ''}`
	return fmtFecha(iso)
}

// Escapa HTML para evitar XSS en template strings
export function escHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
