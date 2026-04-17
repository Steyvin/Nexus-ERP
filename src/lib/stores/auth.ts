import { writable, derived, get } from 'svelte/store'
import type { Session } from '@supabase/supabase-js'
import type { Perfil, Rol } from '$lib/types'

type UsuarioConEmail = Perfil & { email: string }

// ── Stores principales ────────────────────────────────────────────────────────

// Sesión activa de Supabase Auth
export const session = writable<Session | null>(null)

// Perfil completo del usuario autenticado (incluye rol)
export const usuario = writable<UsuarioConEmail | null>(null)

// True mientras se carga la sesión inicial
export const cargando = writable(true)

// ── Derivados de rol ──────────────────────────────────────────────────────────

export const esAdmin         = derived(usuario, ($u) => $u?.rol === 'admin')
export const esFabricador    = derived(usuario, ($u) => $u?.rol === 'fabricador')
export const esDiseñador     = derived(usuario, ($u) => $u?.rol === 'diseñador')
export const esFinanzas      = derived(usuario, ($u) => $u?.rol === 'finanzas')

// ── Helper para verificar roles en código (no reactivo) ───────────────────────

/**
 * Verifica sincrónicamente si el usuario actual tiene alguno de los roles dados.
 * Usar en funciones, no en templates (para templates usar los derived stores).
 */
export function tieneRol(...roles: Rol[]): boolean {
	const u = get(usuario)
	return !!u && u.activo && roles.includes(u.rol)
}

