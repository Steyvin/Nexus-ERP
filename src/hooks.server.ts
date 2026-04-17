import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

// Rutas que NO requieren autenticación
const RUTAS_PUBLICAS = ['/login']

export const handle: Handle = async ({ event, resolve }) => {

	// ── 1. Crear cliente Supabase para este request ───────────────────────────
	// Usa las cookies del usuario para mantener la sesión entre server y client
	event.locals.supabase = createServerClient(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) =>
						event.cookies.set(name, value, { ...options, path: '/' })
					)
				}
			}
		}
	)

	// ── 2. Helper para obtener la sesión de forma segura ─────────────────────
	event.locals.getSession = async () => {
		const {
			data: { session },
			error
		} = await event.locals.supabase.auth.getSession()
		if (error) return null
		return session
	}

	// ── 3. Helper para obtener el perfil completo del usuario ─────────────────
	event.locals.getUsuario = async () => {
		const { data: { user }, error: authErr } = await event.locals.supabase.auth.getUser()
		if (authErr || !user) return null

		const { data: perfil, error } = await event.locals.supabase
			.from('perfiles')
			.select('*')
			.eq('id', user.id)
			.single()

		if (error || !perfil) return null

		// Combina el perfil con el email que viene de auth.users
		return { ...perfil, email: user.email ?? '' }
	}

	// ── 4. Protección de rutas ────────────────────────────────────────────────
	const pathname = event.url.pathname
	const esRutaPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r))

	if (!esRutaPublica) {
		// Ruta protegida: verificar que hay usuario activo de forma segura
		const { data: { user } } = await event.locals.supabase.auth.getUser()

		if (!user) {
			// Sin sesión → redirigir a login guardando la ruta destino
			const destino = encodeURIComponent(pathname)
			redirect(303, `/login?next=${destino}`)
		}

		// Verificar que el perfil del usuario está activo
		const { data: perfil } = await event.locals.supabase
			.from('perfiles')
			.select('activo')
			.eq('id', user.id)
			.single()

		if (perfil && !perfil.activo) {
			// Usuario desactivado → cerrar sesión y redirigir
			await event.locals.supabase.auth.signOut()
			redirect(303, '/login')
		}
	} else if (pathname === '/login') {
		// Ya autenticado intentando ir a login → redirigir al dashboard
		const session = await event.locals.getSession()
		if (session) {
			redirect(303, '/dashboard')
		}
	}

	// ── 5. Resolver la request y agregar headers de seguridad ────────────────
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version'
		}
	})

	// No-index en todas las respuestas HTML (refuerza robots.txt y meta tag)
	response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
	response.headers.set('X-Frame-Options', 'DENY')
	response.headers.set('X-Content-Type-Options', 'nosniff')

	// Content-Security-Policy: protección contra XSS e inyección de contenido
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: blob: https://*.supabase.co",
			"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	)

	return response
}
