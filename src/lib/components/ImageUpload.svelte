<script lang="ts">
	import { subirImagenComprimida } from '$lib/utils/upload'
	import { mostrarToast } from '$lib/stores/ui'

	let {
		value = $bindable(''),
		onchange,
		carpeta = 'referencias',
		placeholder = 'Imagen de referencia',
		compact = false
	}: {
		value?: string
		onchange?: (url: string | undefined) => void
		carpeta?: string
		placeholder?: string
		compact?: boolean
	} = $props()

	let subiendo = $state(false)
	let galeriaRef = $state<HTMLInputElement | null>(null)
	let camaraRef  = $state<HTMLInputElement | null>(null)
	let previewUrl = $derived(value || '')

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return
		// Limpiar el input para permitir re-selección del mismo archivo
		input.value = ''

		subiendo = true
		const { url, error } = await subirImagenComprimida(file, carpeta)
		subiendo = false

		if (error) {
			mostrarToast('Error al subir imagen: ' + error, 'error')
			return
		}

		value = url
		onchange?.(url)
		mostrarToast('Imagen subida correctamente')
	}

	function eliminar() {
		value = ''
		onchange?.(undefined)
		if (galeriaRef) galeriaRef.value = ''
		if (camaraRef)  camaraRef.value  = ''
	}
</script>

{#if compact}
	<!-- Versión compacta para items del carrito -->
	<div class="img-upload-compact">
		{#if previewUrl}
			<div class="img-preview-compact">
				<img src={previewUrl} alt="Referencia" class="img-thumb-compact" />
				<button type="button" onclick={eliminar} class="img-remove-compact" title="Eliminar imagen">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		{:else if subiendo}
			<div class="img-upload-btn-compact uploading">
				<span class="img-spinner"></span>
				<span>Subiendo...</span>
			</div>
		{:else}
			<div class="img-compact-row">
				<!-- Galería -->
				<label class="img-compact-opt">
					<input
						bind:this={galeriaRef}
						type="file"
						accept="image/*"
						onchange={handleFile}
						class="hidden"
					/>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					<span>Galería</span>
				</label>
				<!-- Cámara -->
				<label class="img-compact-opt">
					<input
						bind:this={camaraRef}
						type="file"
						accept="image/*"
						capture="environment"
						onchange={handleFile}
						class="hidden"
					/>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
					<span>Cámara</span>
				</label>
			</div>
		{/if}
	</div>
{:else}
	<!-- Versión completa -->
	<div class="img-upload-full">
		{#if previewUrl}
			<div class="img-preview-full">
				<img src={previewUrl} alt="Referencia" class="img-thumb-full" />
				<div class="img-preview-actions">
					<a href={previewUrl} target="_blank" rel="noopener" class="img-action-btn" title="Ver imagen">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
					</a>
					<label class="img-action-btn" title="Cambiar — galería">
						<input
							bind:this={galeriaRef}
							type="file"
							accept="image/*"
							onchange={handleFile}
							class="hidden"
						/>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					</label>
					<label class="img-action-btn" title="Cambiar — cámara">
						<input
							bind:this={camaraRef}
							type="file"
							accept="image/*"
							capture="environment"
							onchange={handleFile}
							class="hidden"
						/>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
					</label>
					<button type="button" onclick={eliminar} class="img-action-btn img-action-danger" title="Eliminar imagen">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>
		{:else if subiendo}
			<div class="img-dropzone uploading">
				<span class="img-spinner-lg"></span>
				<span class="img-dropzone-text">Subiendo imagen...</span>
			</div>
		{:else}
			<div class="img-full-row">
				<!-- Galería -->
				<label class="img-full-opt">
					<input
						bind:this={galeriaRef}
						type="file"
						accept="image/*"
						onchange={handleFile}
						class="hidden"
					/>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="img-opt-icon"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					<span class="img-opt-label">Subir imagen</span>
					<span class="img-opt-hint">Desde galería o archivos</span>
				</label>
				<!-- Cámara -->
				<label class="img-full-opt">
					<input
						bind:this={camaraRef}
						type="file"
						accept="image/*"
						capture="environment"
						onchange={handleFile}
						class="hidden"
					/>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="img-opt-icon"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
					<span class="img-opt-label">Tomar foto</span>
					<span class="img-opt-hint">Abrir cámara</span>
				</label>
			</div>
		{/if}
	</div>
{/if}

<style>
	.hidden { display: none; }

	/* ── Compacto ── */
	.img-upload-compact { width: 100%; }

	.img-compact-row {
		display: flex;
		gap: 6px;
		width: 100%;
	}

	.img-compact-opt {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 8px;
		border-radius: 8px;
		border: 1px dashed rgba(255,255,255,0.15);
		background: rgba(255,255,255,0.03);
		cursor: pointer;
		font-size: 0.72rem;
		color: var(--text-dim);
		transition: all 0.2s;
		white-space: nowrap;
	}
	.img-compact-opt:hover {
		border-color: rgba(255,255,255,0.3);
		background: rgba(255,255,255,0.06);
		color: var(--text-muted);
	}

	/* spinner compacto reutilizado */
	.img-upload-btn-compact {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px dashed rgba(255,255,255,0.15);
		background: rgba(255,255,255,0.03);
		font-size: 0.72rem;
		color: var(--text-dim);
		width: 100%;
	}
	.img-upload-btn-compact.uploading { pointer-events: none; opacity: 0.7; }

	.img-preview-compact {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px;
		border-radius: 8px;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.1);
	}
	.img-thumb-compact {
		width: 40px;
		height: 40px;
		border-radius: 6px;
		object-fit: cover;
		flex-shrink: 0;
	}
	.img-remove-compact {
		margin-left: auto;
		padding: 4px;
		color: var(--text-dim);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.15s;
		background: none;
		border: none;
	}
	.img-remove-compact:hover {
		color: #f87171;
		background: rgba(248,113,113,0.1);
	}

	/* ── Completo ── */
	.img-upload-full { width: 100%; }

	.img-full-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.img-full-opt {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 20px 12px;
		border: 2px dashed rgba(255,255,255,0.12);
		border-radius: 12px;
		background: rgba(255,255,255,0.02);
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}
	.img-full-opt:hover {
		border-color: rgba(255,255,255,0.25);
		background: rgba(255,255,255,0.04);
	}
	.img-opt-icon { color: var(--text-dim); }
	.img-opt-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.img-opt-hint {
		font-size: 0.68rem;
		color: var(--text-dim);
	}

	/* dropzone spinner */
	.img-dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px 16px;
		border: 2px dashed rgba(255,255,255,0.12);
		border-radius: 12px;
		background: rgba(255,255,255,0.02);
		text-align: center;
	}
	.img-dropzone.uploading { pointer-events: none; opacity: 0.7; }
	.img-dropzone-text {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.img-preview-full {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(255,255,255,0.1);
	}
	.img-thumb-full {
		width: 100%;
		max-height: 200px;
		object-fit: contain;
		display: block;
		background: #080808;
	}
	.img-preview-actions {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
	}
	.img-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: rgba(0,0,0,0.7);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255,255,255,0.15);
		color: rgba(255,255,255,0.8);
		cursor: pointer;
		transition: all 0.15s;
	}
	.img-action-btn:hover {
		background: rgba(0,0,0,0.85);
		color: #fff;
		border-color: rgba(255,255,255,0.3);
	}
	.img-action-danger:hover {
		color: #f87171;
		border-color: rgba(248,113,113,0.4);
	}

	/* ── Spinners ── */
	.img-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255,255,255,0.15);
		border-top-color: var(--brand-light, #aaa);
		border-radius: 50%;
		animation: img-spin 0.6s linear infinite;
		flex-shrink: 0;
	}
	.img-spinner-lg {
		width: 24px;
		height: 24px;
		border: 2.5px solid rgba(255,255,255,0.15);
		border-top-color: var(--brand-light, #aaa);
		border-radius: 50%;
		animation: img-spin 0.6s linear infinite;
	}
	@keyframes img-spin { to { transform: rotate(360deg); } }
</style>
