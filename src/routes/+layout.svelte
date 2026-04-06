<script lang="ts">
	import './layout.css'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { supabase } from '$lib/supabase'
	import { session, usuario, cargando } from '$lib/stores/auth'
	import Sidebar from '$lib/components/layout/Sidebar.svelte'
	import Header from '$lib/components/layout/Header.svelte'
	import Toast from '$lib/components/ui/Toast.svelte'
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
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(async (event, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) {
				await goto($page.url.pathname, { invalidateAll: true })
			}

			if (event === 'SIGNED_OUT') {
				session.set(null)
				usuario.set(null)
				await goto('/login')
			}
		})

		return () => subscription.unsubscribe()
	})

	// Login no muestra el shell de la app
	let isLogin = $derived(($page.url.pathname as string) === '/login')
	let isAuthed = $derived(!!data.session)
	let showShell = $derived(isAuthed && !isLogin)
</script>

<svelte:head>
	<title>Nexus LED — ERP</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if showShell}
	<Sidebar />
	<Header />
	<main class="min-h-dvh bg-[var(--bg)] pt-14 lg:pl-[260px]">
		<div class="mx-auto max-w-7xl p-4 sm:p-6">
			{@render children()}
		</div>
	</main>
{:else}
	{@render children()}
{/if}

<Toast />
