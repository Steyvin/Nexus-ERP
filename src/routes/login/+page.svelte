<script lang="ts">
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { iniciarSesion } from '$lib/utils/auth'
	import logoNexus from '$lib/assets/NEXUS.png'

	let email = $state('')
	let contrasena = $state('')
	let error = $state<string | null>(null)
	let cargando = $state(false)

	// Si viene de una ruta protegida, redirigir ahí después del login
	let destino = $derived(
		($page.url.searchParams.get('next') as string | null) ?? '/dashboard'
	)

	async function handleSubmit(e: Event) {
		e.preventDefault()
		if (cargando) return

		error = null
		cargando = true

		const err = await iniciarSesion(email, contrasena)

		if (err) {
			error = err
			cargando = false
		} else {
			await goto(destino)
		}
	}
</script>

<svelte:head>
	<title>Iniciar sesión — Nexus LED</title>
</svelte:head>

<div class="login-page flex min-h-dvh items-center justify-center px-4">
	<div class="w-full max-w-[380px]">
		<!-- Logo + branding -->
		<div class="mb-10 flex flex-col items-center gap-4">
			<img src={logoNexus} alt="Nexus LED" class="h-12" />
			<p class="text-sm text-[var(--text-muted)]">Inicia sesión en el ERP</p>
		</div>

		<!-- Card del formulario -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Error -->
				{#if error}
					<div class="error-banner flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						{error}
					</div>
				{/if}

				<!-- Email -->
				<div>
					<label for="email" class="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
						>Email</label
					>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						disabled={cargando}
						autocomplete="email"
						class="login-input w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--text-dim)]"
						placeholder="tu@email.com"
					/>
				</div>

				<!-- Contraseña -->
				<div>
					<label for="password" class="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
						>Contraseña</label
					>
					<input
						id="password"
						type="password"
						bind:value={contrasena}
						required
						disabled={cargando}
						autocomplete="current-password"
						class="login-input w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--text-dim)]"
						placeholder="••••••••"
					/>
				</div>

				<!-- Submit -->
				<button
					type="submit"
					disabled={cargando}
					class="login-btn flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[#080808] transition-all disabled:opacity-50"
				>
					{#if cargando}
						<svg class="spinner h-4 w-4" viewBox="0 0 24 24" fill="none">
							<circle
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								opacity="0.25"
							/>
							<path
								d="M12 2a10 10 0 019.95 9"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
							/>
						</svg>
						Entrando...
					{:else}
						Entrar
					{/if}
				</button>
			</form>
		</div>

		<!-- Footer -->
		<p class="mt-6 text-center text-xs text-[var(--text-dim)]">
			Sistema interno — Nexus LED
		</p>
	</div>
</div>

<style>
	.login-page {
		background: var(--bg);
		background-image: radial-gradient(
			ellipse 80% 50% at 50% -20%,
			color-mix(in srgb, var(--brand) 8%, transparent),
			transparent
		);
	}



	.login-input:focus {
		border-color: var(--brand);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent);
	}

	.login-input:disabled {
		opacity: 0.6;
	}

	.login-btn:not(:disabled):hover {
		background: var(--brand-light);
		box-shadow: 0 0 20px color-mix(in srgb, var(--brand) 30%, transparent);
	}

	.error-banner {
		background: color-mix(in srgb, var(--danger) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
		color: var(--danger);
	}

	.spinner {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
