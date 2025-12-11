<script lang="ts">
	import { onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';
	import { PhotographIcon, DocumentAddIcon, XIcon, CheckIcon, LoaderIcon } from '$lib/icons/outline';
	import Button from './button.svelte';

	interface Props {
		label: string;
		accept?: string;
		file?: File | null;
		onFileSelect: (file: File | null) => void;
		id?: string;
		preview?: boolean;
		loading?: boolean;
		initialUrl?: string | null;
	}

	let { label, accept = '*', file = null, loading = false, onFileSelect, id, preview = true, initialUrl = null }: Props = $props();

	let inputRef: HTMLInputElement;
	let dragOver = $state(false);
	let previewUrl: string | null = $state(null);

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

	function handleDragOver(e: DragEvent) {
		if (loading) return;
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		if (loading) return;
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			const droppedFile = e.dataTransfer.files[0];
			onFileSelect(droppedFile);
		}
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			onFileSelect(target.files[0]);
		}
	}

	function removeFile() {
		if (loading) return;
		onFileSelect(null);
		if (inputRef) inputRef.value = '';
	}

	function triggerClick() {
		if (loading) return;
		inputRef?.click();
	}
</script>

<div class="w-full group">
	{#if label}
		<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300" for={id}>
			{label}
		</label>
	{/if}

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
		<input
			bind:this={inputRef}
			{id}
			type="file"
			{accept}
			class="hidden"
			onchange={handleChange}
			disabled={loading}
		/>

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
				
				{#if !loading}
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
</div>
