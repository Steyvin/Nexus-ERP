import { createBrowserClient } from '@supabase/ssr'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

/**
 * Cliente Supabase para el browser.
 * Usa cookies para sincronizar la sesión con el servidor (SSR-safe).
 * Importar en componentes .svelte y archivos del lado cliente.
 * Para operaciones en el servidor usar event.locals.supabase
 */
export const supabase = createBrowserClient(
	PUBLIC_SUPABASE_URL,
	PUBLIC_SUPABASE_ANON_KEY
)

// Re-exportar tipos centralizados
export type { Rol, Perfil as UsuarioApp } from './types'
