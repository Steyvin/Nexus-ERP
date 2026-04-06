// Re-exportaciones principales para imports limpios
export { supabase }                              from './supabase'
export * from './types'
export { fmt, fmtFecha, fmtRelativa, escHtml }  from './utils/format'
export { mostrarToast }                          from './stores/ui'
export { cerrarSesion, iniciarSesion }           from './utils/auth'
export {
	session, usuario, cargando,
	estaAutenticado, esAdmin, esFabricador, esDiseñador, esFinanzas,
	tieneRol, puedeVerFinanzas, puedeGestionar, puedeActualizarProduccion
} from './stores/auth'
