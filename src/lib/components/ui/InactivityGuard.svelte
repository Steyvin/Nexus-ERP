<script lang="ts">
	import { onMount } from 'svelte'
	import { cerrarSesion } from '$lib/utils/auth'
	import { mostrarToast } from '$lib/stores/ui'

	const TIMEOUT_MS = 15 * 60 * 1000     // 15 minutos
	const WARNING_MS = 14 * 60 * 1000     // Aviso a los 14 min
	const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

	let timer: ReturnType<typeof setTimeout>
	let warningTimer: ReturnType<typeof setTimeout>
	let showWarning = $state(false)
	let secondsLeft = $state(60)
	let countdownInterval: ReturnType<typeof setInterval>

	function resetTimers() {
		// Limpiar timers existentes
		clearTimeout(timer)
		clearTimeout(warningTimer)
		clearInterval(countdownInterval)
		showWarning = false

		// Timer de aviso (1 min antes del cierre)
		warningTimer = setTimeout(() => {
			showWarning = true
			secondsLeft = 60
			countdownInterval = setInterval(() => {
				secondsLeft--
				if (secondsLeft <= 0) {
					clearInterval(countdownInterval)
				}
			}, 1000)
		}, WARNING_MS)

		// Timer de cierre
		timer = setTimeout(async () => {
			clearInterval(countdownInterval)
			mostrarToast('Sesión cerrada por inactividad', 'info')
			await cerrarSesion()
		}, TIMEOUT_MS)
	}

	function continuar() {
		resetTimers()
	}

	onMount(() => {
		// Escuchar actividad del usuario
		for (const ev of EVENTS) {
			document.addEventListener(ev, resetTimers, { passive: true })
		}

		// Iniciar timers
		resetTimers()

		return () => {
			for (const ev of EVENTS) {
				document.removeEventListener(ev, resetTimers)
			}
			clearTimeout(timer)
			clearTimeout(warningTimer)
			clearInterval(countdownInterval)
		}
	})
</script>

{#if showWarning}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/15">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8a03a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
			</div>

			<h3 class="text-base font-semibold text-[var(--text)]">Sesión por expirar</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				Tu sesión se cerrará en <span class="font-bold text-[var(--warning)]">{secondsLeft}s</span> por inactividad.
			</p>

			<button
				onclick={continuar}
				class="mt-5 w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-medium text-[#080808] transition-colors hover:bg-[var(--brand-light)]"
			>
				Seguir trabajando
			</button>
		</div>
	</div>
{/if}
