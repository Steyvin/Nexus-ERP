<script lang="ts">
	import './layout.css'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { supabase } from '$lib/supabase'
	import { session, usuario, cargando } from '$lib/stores/auth'
	import type { LayoutData } from './$types'

	let { data, children }: { data: LayoutData; children: any } = $props()

	// Sincronizar stores con los datos del servidor
	$effect(() => {
		session.set(data.session)
		usuario.set(data.usuario)
		cargando.set(false)
	})

	onMount(() => {
		// Escuchar cambios de auth en el browser (login, logout, refresh de token)
		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			async (event, newSession) => {
				if (newSession?.expires_at !== data.session?.expires_at) {
					// La sesión cambió — recargar datos del servidor
					// (SvelteKit invalida el load automáticamente)
					await goto($page.url.pathname, { invalidateAll: true })
				}

				if (event === 'SIGNED_OUT') {
					session.set(null)
					usuario.set(null)
					await goto('/login')
				}
			}
		)

		return () => subscription.unsubscribe()
	})
</script>

<svelte:head>
	<title>Nexus LED — ERP</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
