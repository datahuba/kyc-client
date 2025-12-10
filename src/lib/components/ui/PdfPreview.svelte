<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { LoaderIcon, ExclamationIcon } from '$lib/icons/outline';

	interface Props {
		url: string;
		title?: string;
	}

	let { url, title = 'PDF Preview' }: Props = $props();

	let blobUrl: string | null = $state(null);
	let loading = $state(true);
	let error = $state(false);

	async function loadPdf() {
		loading = true;
		error = false;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error('Failed to load PDF');
			const rawBlob = await res.blob();
			// Force PDF type to avoid browser auto-download logic based on server headers
			const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
			blobUrl = URL.createObjectURL(pdfBlob);
		} catch (e) {
			console.error(e);
			error = true;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (url) loadPdf();
	});

	onDestroy(() => {
		if (blobUrl) URL.revokeObjectURL(blobUrl);
	});
</script>

<div class="relative h-full w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
	{#if loading}
		<LoaderIcon class="animate-spin text-primary-600 size-8" />
	{:else if error}
		<div class="text-center p-4">
			<ExclamationIcon class="mx-auto size-8 text-red-500 mb-2" />
			<p class="text-sm text-gray-500">Error al cargar documento</p>
			<button class="text-xs text-primary-600 hover:underline mt-2" onclick={loadPdf}>Reintentar</button>
		</div>
	{:else if blobUrl}
		<div class="h-full w-full overflow-hidden">
			<iframe 
				src="{blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
				{title} 
				class="h-full w-[calc(100%+17px)] border-0" 
				scrolling="no"
			></iframe>
		</div>
	{/if}
</div>
