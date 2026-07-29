<script lang="ts">
	import { onDestroy } from 'svelte';
	import { PhotographIcon, DocumentAddIcon, XIcon, LoaderIcon } from '$lib/icons/outline';

	interface Props {
		label?: string;
		accept?: string;
		file?: File | null;
		onFileSelect: (file: File | null) => void;
		id?: string;
		preview?: boolean;
		loading?: boolean;
		initialUrl?: string | null;
		isEditable?: boolean;
		children?: import('svelte').Snippet;
		disabled?: boolean;
		// F-090 (2026-07-29): validación de tamaño de archivo ANTES de subir.
		// Caso Nelly: imagen muy pesada falla la subida y el usuario pierde
		// la noción del estado de los demás archivos. Con esta validación
		// prevenimos el error mostrando un mensaje claro antes de consumir
		// el ancho de banda. Default: 15MB (cubre comprobantes de pago y
		// PDFs típicos, evita imágenes de celular de 50MB+).
		maxSizeMB?: number;
	}

	let {
		label,
		accept = '*',
		file = null,
		loading = false,
		onFileSelect,
		id,
		preview = true,
		initialUrl = null,
		isEditable = false,
		children,
		disabled = false,
		maxSizeMB = 15
	}: Props = $props();

	let inputRef: HTMLInputElement;
	let dragOver = $state(false);
	let previewUrl: string | null = $state(null);
	let sizeError = $state('');

	$effect(() => {
		if (file && preview) {
			if (file.type.startsWith('image/')) {
				const reader = new FileReader();
				reader.onload = (e) => {
					previewUrl = e.target?.result as string;
				};
				reader.readAsDataURL(file);
			} else {
				// For PDFs/other files, we don't preview inline to avoid auto-downloads
				previewUrl = null;
			}
		} else if (initialUrl && !file) {
			previewUrl = initialUrl;
		} else {
			previewUrl = null;
		}
	});

	onDestroy(() => {
		if (previewUrl && file?.type === 'application/pdf') {
			URL.revokeObjectURL(previewUrl);
		}
	});

	// F-090: helper para validar tamaño
	function validarTamano(f: File): boolean {
		sizeError = '';
		const sizeMB = f.size / 1024 / 1024;
		if (sizeMB > maxSizeMB) {
			sizeError = `El archivo pesa ${sizeMB.toFixed(1)} MB y el máximo permitido es ${maxSizeMB} MB. Comprime la imagen o usa un PDF más liviano.`;
			return false;
		}
		return true;
	}

	function handleDragOver(e: DragEvent) {
		if (loading || disabled) return;
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		if (loading || disabled) return;
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			const droppedFile = e.dataTransfer.files[0];
			if (validarTamano(droppedFile)) {
				onFileSelect(droppedFile);
			} else {
				// Reset input para que pueda re-intentar con el mismo archivo
				if (inputRef) inputRef.value = '';
			}
		}
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const selected = target.files[0];
			if (validarTamano(selected)) {
				onFileSelect(selected);
			} else {
				// Reset input para que pueda re-intentar con el mismo archivo
				target.value = '';
			}
		}
	}

	function removeFile() {
		if (loading || disabled) return;
		onFileSelect(null);
		if (inputRef) inputRef.value = '';
	}

	function triggerClick() {
		if (loading || disabled) return;
		inputRef?.click();
	}
</script>

<div class="w-full group">
	{#if label}
		<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300" for={id}>
			{label}
		</label>
	{/if}

	<input
		bind:this={inputRef}
		{id}
		type="file"
		{accept}
		class="hidden"
		onchange={handleChange}
		disabled={loading || disabled}
	/>

	{#if sizeError}
		<p class="mt-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-1" role="alert">
			<XIcon class="size-3.5 shrink-0 mt-0.5" />
			<span>{sizeError}</span>
		</p>
	{/if}

	{#if children}
		<div onclick={triggerClick}>
			{@render children()}
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="relative flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ease-in-out
			{dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-400'}
			px-6 py-4
			{loading ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			onclick={triggerClick}
		>
			{#if loading}
				<div class="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-lg dark:bg-gray-800/50">
					<LoaderIcon class="animate-spin text-primary-600 size-8" />
				</div>
			{/if}

			{#if file || previewUrl}
				<div class="relative flex w-full h-full flex-col items-center justify-center gap-3">
					<!-- Image Preview -->
					{#if previewUrl && ((file && file.type.startsWith('image/')) || (!file && accept.includes('image')))}
						<div class="relative h-full w-full overflow-hidden rounded-lg shadow-sm group/preview">
							<img src={previewUrl} alt="Preview" class="h-full w-full object-cover transition-transform group-hover/preview:scale-105" />
							{#if !file && initialUrl}
								<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity">
									<a href={initialUrl} target="_blank" rel="noopener noreferrer" class="text-white hover:underline text-sm font-medium flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
										<DocumentAddIcon class="size-4" /> Ver original
									</a>
								</div>
							{/if}
						</div>
					<!-- Document/PDF State -->
					{:else}
						<div class="flex flex-col items-center justify-center gap-2 p-4 text-center">
							<div class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
								<DocumentAddIcon class="size-8" />
							</div>
							
							{#if file}
								<div>
									<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{file.name}</p>
									<p class="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
								</div>
							{:else if initialUrl}
								<div class="flex flex-col items-center gap-2">
									<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Archivo cargado</p>
									<a 
										href={initialUrl} 
										target="_blank" 
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										Ver archivo actual
									</a>
								</div>
							{/if}
						</div>
					{/if}
					
					{#if !loading && !isEditable}
						<button 
							type="button" 
							class="absolute -right-2 -top-2 rounded-full bg-red-100 p-1 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 shadow-sm z-10"
							onclick={(e) => { e.stopPropagation(); removeFile(); }}
						>
							<XIcon class="size-4" />
						</button>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center text-center">
					<div class="mb-3 rounded-full bg-gray-100 p-3 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
						{#if accept.includes('image')}
							<PhotographIcon class="size-6 dashed" />
						{:else}
							<DocumentAddIcon class="size-6" />
						{/if}
					</div>
					<p class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
						<span class="text-primary-600 hover:underline">Haga clic para subir</span> o arrastre y suelte
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{accept === '*' ? 'Cualquier archivo' : accept.replace(/,/g, ', ')}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
