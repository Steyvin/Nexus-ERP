// Re-exportaciones principales para imports limpios
export { supabase }                              from './supabase'
export * from './types'
export { fmt, fmtFecha, fmtRelativa, escHtml }  from './utils/format'
export { mostrarToast }                          from './stores/ui'
export { cerrarSesion, iniciarSesion }           from './utils/auth'
export {
	session, usuario, cargando,
	esAdmin, esFabricador, esDiseñador, esFinanzas,
	tieneRol
} from './stores/auth'

