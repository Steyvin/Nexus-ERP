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
	let inputRef = $state<HTMLInputElement | null>(null)
	let previewUrl = $derived(value || '')

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

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
		if (inputRef) inputRef.value = ''
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
		{:else}
			<label class="img-upload-btn-compact" class:uploading={subiendo}>
				<input
					bind:this={inputRef}
					type="file"
					accept="image/*"
					capture="environment"
					onchange={handleFile}
					class="hidden"
					disabled={subiendo}
				/>
				{#if subiendo}
					<span class="img-spinner"></span>
					<span>Subiendo...</span>
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					<span>{placeholder}</span>
				{/if}
			</label>
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
					<label class="img-action-btn" title="Cambiar imagen">
						<input
							bind:this={inputRef}
							type="file"
							accept="image/*"
							capture="environment"
							onchange={handleFile}
							class="hidden"
							disabled={subiendo}
						/>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					</label>
					<button type="button" onclick={eliminar} class="img-action-btn img-action-danger" title="Eliminar imagen">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>
		{:else}
			<label class="img-dropzone" class:uploading={subiendo}>
				<input
					bind:this={inputRef}
					type="file"
					accept="image/*"
					capture="environment"
					onchange={handleFile}
					class="hidden"
					disabled={subiendo}
				/>
				{#if subiendo}
					<span class="img-spinner-lg"></span>
					<span class="img-dropzone-text">Subiendo imagen...</span>
				{:else}
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="img-dropzone-icon"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					<span class="img-dropzone-text">{placeholder}</span>
					<span class="img-dropzone-hint">Toca para subir foto o tomar una</span>
				{/if}
			</label>
		{/if}
	</div>
{/if}

<style>
	.hidden { display: none; }

	/* ── Compacto ── */
	.img-upload-compact { width: 100%; }

	.img-upload-btn-compact {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px dashed rgba(255,255,255,0.15);
		background: rgba(255,255,255,0.03);
		cursor: pointer;
		font-size: 0.72rem;
		color: var(--text-dim);
		transition: all 0.2s;
		width: 100%;
	}
	.img-upload-btn-compact:hover {
		border-color: rgba(255,255,255,0.3);
		background: rgba(255,255,255,0.06);
		color: var(--text-muted);
	}
	.img-upload-btn-compact.uploading {
		pointer-events: none;
		opacity: 0.7;
	}

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
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}
	.img-dropzone:hover {
		border-color: rgba(255,255,255,0.25);
		background: rgba(255,255,255,0.04);
	}
	.img-dropzone.uploading {
		pointer-events: none;
		opacity: 0.7;
	}
	.img-dropzone-icon {
		color: var(--text-dim);
	}
	.img-dropzone-text {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-muted);
	}
	.img-dropzone-hint {
		font-size: 0.7rem;
		color: var(--text-dim);
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
