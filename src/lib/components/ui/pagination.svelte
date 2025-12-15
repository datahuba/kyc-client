<script lang="ts">
	import { ChevronLeftIcon, ChevronRightIcon } from '$lib/icons/outline';
	import Button from '$lib/components/ui/button.svelte';

	interface Props {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		limit: number;
		onPageChange: (page: number) => void;
		onLimitChange?: (limit: number) => void;
	}

	let { 
		currentPage = 1, 
		totalPages = 1, 
		totalItems = 0, 
		limit = 10,
		onPageChange,
		onLimitChange
	}: Props = $props();

	function handlePrevious() {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	}

	function handleNext() {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	}

	function handleFirst() {
		if (currentPage !== 1) {
			onPageChange(1);
		}
	}

	function handleLast() {
		if (currentPage !== totalPages) {
			onPageChange(totalPages);
		}
	}

	function handleLimitChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newLimit = parseInt(target.value);
		if (onLimitChange) {
			onLimitChange(newLimit);
		}
	}

	// Calculate visible page range
	function getPageRange() {
		const delta = 2;
		const range = [];
		for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
			range.push(i);
		}

		if (currentPage - delta > 2) {
			range.unshift('...');
		}
		if (currentPage + delta < totalPages - 1) {
			range.push('...');
		}

		range.unshift(1);
		if (totalPages > 1) {
			range.push(totalPages);
		}

		return range;
	}

	let pages = $derived(getPageRange());
</script>

<div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6">
	<div class="flex flex-1 justify-between sm:hidden">
		<Button 
			variant="secondary" 
			size="sm" 
			disabled={currentPage === 1} 
			onclick={handlePrevious}
		>
			Anterior
		</Button>
		<Button 
			variant="secondary" 
			size="sm" 
			disabled={currentPage === totalPages} 
			onclick={handleNext}
		>
			Siguiente
		</Button>
	</div>
	
	<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
		<div class="flex items-center gap-4">
			<p class="text-sm text-gray-700 dark:text-gray-300">
				Mostrando
				<span class="font-medium">{totalItems === 0 ? 0 : (currentPage - 1) * limit + 1}</span>
				a
				<span class="font-medium">{Math.min(currentPage * limit, totalItems)}</span>
				de
				<span class="font-medium">{totalItems}</span>
				resultados
			</p>
			
			{#if onLimitChange}
				<div class="flex items-center gap-2">
					<label for="limit" class="text-sm text-gray-600 dark:text-gray-400">Mostrar</label>
					<select
						id="limit"
						value={limit}
						onchange={handleLimitChange}
						class="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</div>
			{/if}
		</div>
		
		<div>
			<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
				<!-- <button
					onclick={handleFirst}
					disabled={currentPage === 1}
					class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
				>
					<span class="sr-only">Primera</span>
					<span class="text-xs font-bold leading-none">{'<<'}</span>
				</button> -->
				<button
					onclick={handlePrevious}
					disabled={currentPage === 1}
					class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
				>
					<span class="sr-only">Anterior</span>
					<ChevronLeftIcon class="h-4 w-4" />
				</button>
				
				{#each pages as page}
					{#if page === '...'}
						<span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-gray-300 dark:ring-gray-600">...</span>
					{:else}
						<button
							onclick={() => onPageChange(page as number)}
							aria-current={page === currentPage ? 'page' : undefined}
							class={page === currentPage
								? 'relative z-10 inline-flex items-center bg-primary-600 px-4 py-2 text-sm font-bold text-black focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
								: 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700'}
						>
							{page}
						</button>
					{/if}
				{/each}

				<button
					onclick={handleNext}
					disabled={currentPage === totalPages}
					class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
				>
					<span class="sr-only">Siguiente</span>
					<ChevronRightIcon class="h-4 w-4" />
				</button>
				<!-- <button
					onclick={handleLast}
					disabled={currentPage === totalPages}
					class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-700"
				>
					<span class="sr-only">Última</span>
					<span class="text-xs font-bold leading-none">{'>>'}</span>
				</button> -->
			</nav>
		</div>
	</div>
</div>
