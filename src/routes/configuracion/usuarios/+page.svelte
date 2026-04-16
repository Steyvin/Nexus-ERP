<script lang="ts">
	import { enhance } from '$app/forms'
	import { invalidateAll } from '$app/navigation'
	import { mostrarToast } from '$lib/stores/ui'
	import { fmtFecha, fmtRelativa } from '$lib/utils/format'
	import type { Rol } from '$lib/types'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const ROLES: { value: Rol; label: string; color: string }[] = [
		{ value: 'admin',      label: 'Admin',      color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
		{ value: 'fabricador', label: 'Fabricador', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30'       },
		{ value: 'diseñador',  label: 'Diseñador',  color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
		{ value: 'finanzas',   label: 'Finanzas',   color: 'bg-green-500/15 text-green-400 border-green-500/30'    }
	]

	function rolColor(rol: Rol): string {
		return ROLES.find((r) => r.value === rol)?.color ?? ''
	}
	function rolLabel(rol: Rol): string {
		return ROLES.find((r) => r.value === rol)?.label ?? rol
	}

	// Iniciales del avatar
	function iniciales(nombre: string): string {
		return nombre.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
	}

	// Color de avatar por rol
	const avatarColor: Record<Rol, string> = {
		admin:      'bg-purple-500/20 text-purple-300',
		fabricador: 'bg-blue-500/20 text-blue-300',
		diseñador:  'bg-orange-500/20 text-orange-300',
		finanzas:   'bg-green-500/20 text-green-300'
	}

	// Estado UI
	let modalInvitar = $state(false)
	let invEmail  = $state('')
	let invNombre = $state('')
	let invClave  = $state('')
	let invRol    = $state<Rol>('fabricador')
	let enviando  = $state(false)

	// Visibilidad de claves por usuario
	let clavesVisibles = $state<Set<string>>(new Set())

	function toggleClave(userId: string) {
		const nuevoSet = new Set(clavesVisibles)
		if (nuevoSet.has(userId)) nuevoSet.delete(userId)
		else nuevoSet.add(userId)
		clavesVisibles = nuevoSet
	}

	// Eliminar usuario
	let eliminandoUsuario = $state<string | null>(null)
	let nombreEliminar = $state('')

	// Cambiar contraseña
	let cambiandoClave = $state<string | null>(null)
	let nombreCambiarClave = $state('')
	let nuevaClave = $state('')

	function abrirModal() {
		invEmail = ''; invNombre = ''; invClave = ''; invRol = 'fabricador'
		modalInvitar = true
	}

	function abrirEliminar(u: any) {
		eliminandoUsuario = u.id
		nombreEliminar = u.nombre
	}

	function abrirCambiarClave(u: any) {
		cambiandoClave = u.id
		nombreCambiarClave = u.nombre
		nuevaClave = ''
	}
</script>

<svelte:head>
	<title>Usuarios — Nexus LED</title>
</svelte:head>

<div>
	<!-- ═══ CABECERA ═══ -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-[var(--text)]">Gestión de usuarios</h1>
			<p class="mt-0.5 text-xs text-[var(--text-dim)]">{data.usuarios.length} usuario{data.usuarios.length !== 1 ? 's' : ''} registrado{data.usuarios.length !== 1 ? 's' : ''}</p>
		</div>
		<button onclick={abrirModal} class="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
			</svg>
			Crear usuario
		</button>
	</div>

	<!-- ═══ TABLA DE USUARIOS ═══ -->
	<div class="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">

		{#if data.usuarios.length === 0}
			<div class="py-16 text-center text-sm text-[var(--text-dim)]">
				No hay usuarios registrados
			</div>
		{:else}
			<!-- Desktop: tabla -->
			<div class="hidden sm:block overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
							<th class="px-5 py-3 font-medium">Usuario</th>
							<th class="px-5 py-3 font-medium">Rol</th>
							<th class="px-5 py-3 font-medium">Clave</th>
							<th class="px-5 py-3 font-medium">Último acceso</th>
							<th class="px-5 py-3 font-medium">Miembro desde</th>
							<th class="px-5 py-3 font-medium text-center">Estado</th>
							<th class="px-5 py-3 font-medium text-center">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each data.usuarios as u (u.id)}
							{@const esMismo = u.id === data.usuarioActualId}
							<tr class="border-b border-[var(--border)] last:border-b-0 {!u.activo ? 'opacity-50' : ''}">

								<!-- Avatar + nombre + email -->
								<td class="px-5 py-3.5">
									<div class="flex items-center gap-3">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold {avatarColor[u.rol as Rol]}">
											{iniciales(u.nombre)}
										</div>
										<div class="min-w-0">
											<div class="flex items-center gap-2">
												<p class="truncate font-medium text-[var(--text)]">{u.nombre}</p>
												{#if esMismo}
													<span class="rounded bg-[var(--bg-card-2)] px-1.5 py-0.5 text-[9px] text-[var(--text-dim)]">Tú</span>
												{/if}
											</div>
											<p class="truncate text-[11px] text-[var(--text-dim)]">{u.email}</p>
										</div>
									</div>
								</td>

								<!-- Rol (select editable para admin, badge para el propio) -->
								<td class="px-5 py-3.5">
									{#if esMismo}
										<span class="rounded-full border px-2.5 py-0.5 text-[10px] font-medium {rolColor(u.rol as Rol)}">
											{rolLabel(u.rol as Rol)}
										</span>
									{:else}
										<form method="POST" action="?/cambiarRol" use:enhance={() => {
											return async ({ result }) => {
												if (result.type === 'success') {
													mostrarToast('Rol actualizado')
													invalidateAll()
												} else if (result.type === 'failure') {
													mostrarToast((result.data as any)?.error ?? 'Error', 'error')
												}
											}
										}}>
											<input type="hidden" name="user_id" value={u.id} />
											<select
												name="rol"
												onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
												class="input-field rounded-lg py-1 text-xs"
												disabled={!u.activo}
											>
												{#each ROLES as r}
													<option value={r.value} selected={u.rol === r.value}>{r.label}</option>
												{/each}
											</select>
										</form>
									{/if}
								</td>

								<!-- Clave -->
								<td class="px-5 py-3.5">
									{#if u.clave_texto}
										<div class="flex items-center gap-1.5">
											<span class="text-xs font-mono text-[var(--text-dim)]">
												{clavesVisibles.has(u.id) ? u.clave_texto : '••••••••'}
											</span>
											<button
												type="button"
												onclick={() => toggleClave(u.id)}
												class="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
												title={clavesVisibles.has(u.id) ? 'Ocultar clave' : 'Mostrar clave'}
											>
												{#if clavesVisibles.has(u.id)}
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
												{:else}
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
												{/if}
											</button>
										</div>
									{:else}
										<span class="text-[11px] text-[var(--text-dim)]">—</span>
									{/if}
								</td>

								<!-- Último acceso -->
								<td class="px-5 py-3.5 text-xs text-[var(--text-dim)]">
									{u.ultimo_acceso ? fmtRelativa(u.ultimo_acceso) : 'Nunca'}
								</td>

								<!-- Fecha creación -->
								<td class="px-5 py-3.5 text-xs text-[var(--text-dim)]">
									{fmtFecha(u.created_at)}
								</td>

								<!-- Toggle activo -->
								<td class="px-5 py-3.5 text-center">
									{#if esMismo}
										<span class="text-[11px] text-[var(--text-dim)]">—</span>
									{:else}
										<form method="POST" action="?/toggleActivo" use:enhance={() => {
											return async ({ result }) => {
												if (result.type === 'success') {
													mostrarToast(u.activo ? 'Usuario desactivado' : 'Usuario activado', u.activo ? 'info' : 'exito')
													invalidateAll()
												} else if (result.type === 'failure') {
													mostrarToast((result.data as any)?.error ?? 'Error', 'error')
												}
											}
										}}>
											<input type="hidden" name="user_id" value={u.id} />
											<input type="hidden" name="activo" value={String(u.activo)} />
											<button
												type="submit"
												class="group relative inline-flex h-5 w-9 items-center rounded-full transition-colors
													{u.activo ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}"
												title={u.activo ? 'Desactivar acceso' : 'Activar acceso'}
											>
												<span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
													{u.activo ? 'translate-x-4' : 'translate-x-1'}"></span>
											</button>
										</form>
									{/if}
								</td>

								<!-- Acciones -->
								<td class="px-5 py-3.5 text-center">
									{#if !esMismo}
										<div class="flex items-center justify-center gap-1">
											<button
												type="button"
												onclick={() => abrirCambiarClave(u)}
												class="rounded-lg p-1.5 text-[var(--text-dim)] hover:text-[var(--brand-light)] hover:bg-[var(--bg-card-2)] transition-colors"
												title="Cambiar contraseña"
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
											</button>
											<button
												type="button"
												onclick={() => abrirEliminar(u)}
												class="rounded-lg p-1.5 text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
												title="Eliminar usuario"
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
											</button>
										</div>
									{:else}
										<span class="text-[11px] text-[var(--text-dim)]">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile: cards -->
			<div class="sm:hidden divide-y divide-[var(--border)]">
				{#each data.usuarios as u (u.id)}
					{@const esMismo = u.id === data.usuarioActualId}
					<div class="p-4 {!u.activo ? 'opacity-50' : ''}">
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-3">
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold {avatarColor[u.rol as Rol]}">
									{iniciales(u.nombre)}
								</div>
								<div>
									<div class="flex items-center gap-1.5">
										<p class="text-sm font-medium text-[var(--text)]">{u.nombre}</p>
										{#if esMismo}<span class="text-[9px] text-[var(--text-dim)]">(Tú)</span>{/if}
									</div>
									<p class="text-xs text-[var(--text-dim)]">{u.email}</p>
								</div>
							</div>

							{#if !esMismo}
								<form method="POST" action="?/toggleActivo" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') { mostrarToast(u.activo ? 'Desactivado' : 'Activado'); invalidateAll() }
									}
								}}>
									<input type="hidden" name="user_id" value={u.id} />
									<input type="hidden" name="activo" value={String(u.activo)} />
									<button type="submit"
										class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors {u.activo ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}"
									>
										<span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform {u.activo ? 'translate-x-4' : 'translate-x-1'}"></span>
									</button>
								</form>
							{/if}
						</div>

						<div class="mt-3 flex flex-wrap items-center gap-2">
							{#if esMismo}
								<span class="rounded-full border px-2.5 py-0.5 text-[10px] font-medium {rolColor(u.rol as Rol)}">{rolLabel(u.rol as Rol)}</span>
							{:else}
								<form method="POST" action="?/cambiarRol" use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') { mostrarToast('Rol actualizado'); invalidateAll() }
									}
								}}>
									<input type="hidden" name="user_id" value={u.id} />
									<select name="rol" onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()} class="input-field rounded-lg py-1 text-xs">
										{#each ROLES as r}<option value={r.value} selected={u.rol === r.value}>{r.label}</option>{/each}
									</select>
								</form>
							{/if}
							<span class="text-[11px] text-[var(--text-dim)]">
								{u.ultimo_acceso ? `Activo ${fmtRelativa(u.ultimo_acceso)}` : 'Nunca accedió'}
							</span>
							{#if u.clave_texto}
								<div class="flex items-center gap-1">
									<span class="text-[10px] font-mono text-[var(--text-dim)]">
										{clavesVisibles.has(u.id) ? u.clave_texto : '••••••'}
									</span>
									<button type="button" onclick={() => toggleClave(u.id)} class="text-[var(--text-dim)] hover:text-[var(--text)]">
										{#if clavesVisibles.has(u.id)}
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
										{:else}
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
										{/if}
									</button>
								</div>
							{/if}

							{#if !esMismo}
								<div class="flex items-center gap-1 ml-auto">
									<button type="button" onclick={() => abrirCambiarClave(u)} class="rounded-lg p-1.5 text-[var(--text-dim)] hover:text-[var(--brand-light)] hover:bg-[var(--bg-card-2)] transition-colors" title="Cambiar contraseña">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
									</button>
									<button type="button" onclick={() => abrirEliminar(u)} class="rounded-lg p-1.5 text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar usuario">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Leyenda de roles ── -->
	<div class="mt-4 flex flex-wrap gap-3">
		{#each ROLES as r}
			<span class="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
				<span class="rounded-full border px-2 py-0.5 text-[10px] {r.color}">{r.label}</span>
				{#if r.value === 'admin'}acceso total
				{:else if r.value === 'fabricador'}producción
				{:else if r.value === 'diseñador'}diseño
				{:else}reportes financieros{/if}
			</span>
		{/each}
	</div>
</div>

<!-- ═══ MODAL: INVITAR USUARIO ═══ -->
{#if modalInvitar}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (modalInvitar = false)}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-5 flex items-center justify-between">
				<div>
					<h2 class="text-base font-semibold text-[var(--text)]">Crear usuario</h2>
					<p class="mt-0.5 text-xs text-[var(--text-dim)]">Asigna un correo y clave para acceder al ERP</p>
				</div>
				<button
					onclick={() => (modalInvitar = false)}
					class="rounded-lg p-1 text-[var(--text-dim)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text)] transition-colors"
					aria-label="Cerrar"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<form method="POST" action="?/crearUsuario" use:enhance={() => {
				enviando = true
				return async ({ result }) => {
					enviando = false
					if (result.type === 'success') {
						const msg = (result.data as any)?.mensaje ?? 'Usuario creado'
						mostrarToast(msg)
						modalInvitar = false
						invalidateAll()
					} else if (result.type === 'failure') {
						mostrarToast((result.data as any)?.error ?? 'Error al crear usuario', 'error')
					}
				}
			}} class="space-y-4">

				<div>
					<label for="inv-nombre" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Nombre completo</label>
					<input
						id="inv-nombre"
						type="text"
						name="nombre"
						bind:value={invNombre}
						placeholder="Ej: Juan Pérez"
						required
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="inv-email" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Email</label>
					<input
						id="inv-email"
						type="email"
						name="email"
						bind:value={invEmail}
						placeholder="usuario@empresa.com"
						required
						class="input-field w-full"
					/>
				</div>

				<div>
					<label for="inv-rol" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Rol</label>
					<select id="inv-rol" name="rol" bind:value={invRol} class="input-field w-full">
						{#each ROLES as r}
							<option value={r.value}>{r.label}</option>
						{/each}
					</select>

					<!-- Descripción del rol seleccionado -->
					<p class="mt-1.5 text-[11px] text-[var(--text-dim)]">
						{#if invRol === 'admin'}Acceso total al sistema incluyendo configuración
						{:else if invRol === 'fabricador'}Ve pedidos y actualiza estados de producción
						{:else if invRol === 'diseñador'}Ve pedidos asignados y sube archivos de diseño
						{:else}Solo lectura de reportes y resumen financiero{/if}
					</p>
				</div>

				<div>
					<label for="inv-clave" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Contraseña</label>
					<input
						id="inv-clave"
						type="text"
						name="clave"
						bind:value={invClave}
						placeholder="Mínimo 6 caracteres"
						required
						minlength="6"
						class="input-field w-full font-mono"
					/>
					<p class="mt-1 text-[10px] text-[var(--text-dim)]">El usuario usará esta clave para entrar al ERP. Solo el admin puede verla.</p>
				</div>

				<div class="flex gap-3 pt-1">
					<button
						type="button"
						onclick={() => (modalInvitar = false)}
						class="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] transition-colors"
					>Cancelar</button>
					<button
						type="submit"
						disabled={enviando || !invEmail.trim() || !invNombre.trim() || invClave.length < 6}
						class="btn-primary flex-1 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
					>
						{enviando ? 'Creando...' : 'Crear usuario'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══ MODAL: CONFIRMAR ELIMINACIÓN ═══ -->
{#if eliminandoUsuario}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (eliminandoUsuario = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="text-base font-semibold text-red-400">Eliminar usuario</h3>
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				¿Eliminar a <span class="font-medium text-[var(--text)]">{nombreEliminar}</span>? Se eliminará su cuenta y perfil del sistema. Esta acción no se puede deshacer.
			</p>
			<form method="POST" action="?/eliminarUsuario" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Usuario eliminado')
						eliminandoUsuario = null
						invalidateAll()
					} else if (result.type === 'failure') {
						mostrarToast((result.data as any)?.error ?? 'Error al eliminar', 'error')
					}
				}
			}}>
				<input type="hidden" name="user_id" value={eliminandoUsuario} />
				<div class="mt-5 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (eliminandoUsuario = null)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] transition-colors"
					>Cancelar</button>
					<button
						type="submit"
						class="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
					>Eliminar</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══ MODAL: CAMBIAR CONTRASEÑA ═══ -->
{#if cambiandoClave}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (cambiandoClave = null)}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="text-base font-semibold text-[var(--text)]">Cambiar contraseña</h3>
			<p class="mt-1 text-xs text-[var(--text-dim)]">
				Nueva contraseña para <span class="font-medium text-[var(--text-muted)]">{nombreCambiarClave}</span>
			</p>
			<form method="POST" action="?/cambiarClave" use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						mostrarToast('Contraseña actualizada')
						cambiandoClave = null
						invalidateAll()
					} else if (result.type === 'failure') {
						mostrarToast((result.data as any)?.error ?? 'Error al cambiar contraseña', 'error')
					}
				}
			}}>
				<input type="hidden" name="user_id" value={cambiandoClave} />
				<div class="mt-4">
					<label for="nueva-clave" class="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Nueva contraseña</label>
					<input
						id="nueva-clave"
						type="text"
						name="nueva_clave"
						bind:value={nuevaClave}
						placeholder="Mínimo 6 caracteres"
						required
						minlength="6"
						class="input-field w-full font-mono"
					/>
				</div>
				<div class="mt-5 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (cambiandoClave = null)}
						class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] transition-colors"
					>Cancelar</button>
					<button
						type="submit"
						disabled={nuevaClave.length < 6}
						class="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
					>Guardar</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.btn-primary {
		background: var(--brand);
		color: #080808;
		transition: background 0.15s;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-light);
	}

	.input-field {
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--bg-card);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--text);
		outline: none;
		width: 100%;
		transition: border-color 0.15s;
	}
	.input-field:focus {
		border-color: var(--brand);
	}
	.input-field:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
