<script lang="ts">
	import './layout.css'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { supabase } from '$lib/supabase'
	import { session, usuario, cargando } from '$lib/stores/auth'
	import { ROL_LABEL } from '$lib/types'
	import type { Rol } from '$lib/types'
	import Sidebar from '$lib/components/layout/Sidebar.svelte'
	import Header from '$lib/components/layout/Header.svelte'
	import Toast from '$lib/components/ui/Toast.svelte'
	import InactivityGuard from '$lib/components/ui/InactivityGuard.svelte'
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

	const rolColor: Record<string, string> = {
		admin:      'bg-purple-500/15 text-purple-400 border-purple-500/30',
		fabricador: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
		'diseñador': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
		finanzas:   'bg-green-500/15 text-green-400 border-green-500/30'
	}
</script>

<svelte:head>
	<title>Nexus LED — ERP</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if showShell}
	<Sidebar />
	<Header />
	<InactivityGuard />
	<main class="min-h-dvh bg-[var(--bg)] pt-14 lg:pl-[260px]">
		<div class="mx-auto max-w-7xl p-4 sm:p-6">
			{#if $usuario}
				<div class="mb-4 flex items-center gap-2">
					<span class="text-sm text-[var(--text-muted)]">Hola, <span class="font-medium text-[var(--text)]">{$usuario.nombre}</span></span>
					<span class="rounded-full border px-2 py-0.5 text-[10px] font-semibold {rolColor[$usuario.rol] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'}">
						{ROL_LABEL[$usuario.rol as Rol] ?? $usuario.rol}
					</span>
				</div>
			{/if}
			{@render children()}
		</div>
	</main>
{:else}
	{@render children()}
{/if}

<Toast />
