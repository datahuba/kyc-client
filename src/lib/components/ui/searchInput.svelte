<script lang="ts">
	import { SearchIcon, XIcon } from '$lib/icons/outline';

	interface Props {
		value: string;
		placeholder?: string;
		debounceMs?: number;
		autofocus?: boolean;
		onInput?: (value: string) => void;
		onClear?: () => void;
		class?: string;
	}

	let {
		value = $bindable(''),
		placeholder = 'Buscar...',
		debounceMs = 300,
		autofocus = false,
		onInput,
		onClear,
		class: className = '',
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let debounceTimer: any;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onInput?.(value);
		}, debounceMs);
	}

	function handleClear() {
		value = '';
		if (debounceTimer) clearTimeout(debounceTimer);
		onInput?.('');
		onClear?.();
		inputRef?.focus();
	}
</script>

<div class={`relative w-full ${className}`}>
	<div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
		<SearchIcon class="size-4" />
	</div>
	<input
		bind:this={inputRef}
		type="search"
		inputmode="search"
		autocomplete="off"
		{autofocus}
		{placeholder}
		{value}
		oninput={handleInput}
		class="w-full pl-10 pr-10 py-2.5 sm:py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all active:scale-[0.998]"
	/>
	{#if value}
		<button
			type="button"
			onclick={handleClear}
			class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 dark:text-gray-500 active:scale-90 transition-transform rounded-full active:bg-gray-100 dark:active:bg-gray-800"
			aria-label="Limpiar búsqueda"
		>
			<XIcon class="size-4" />
		</button>
	{/if}
</div>
