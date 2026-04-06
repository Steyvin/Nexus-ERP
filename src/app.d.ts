import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Perfil } from '$lib/types'

declare global {
	namespace App {
		interface Locals {
			// Cliente Supabase creado por request (con cookies del usuario)
			supabase: SupabaseClient
			// Helpers para obtener sesión y perfil del usuario
			getSession:  () => Promise<Session | null>
			getUsuario:  () => Promise<(Perfil & { email: string }) | null>
		}
		interface PageData {
			// Datos disponibles en todas las páginas vía $page.data
			session:  Session | null
			usuario:  (Perfil & { email: string }) | null
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
