<script lang="ts">
	import { XMarkIcon } from '$lib/icons/outline';

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
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="currentColor"
			class="size-4"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
				clip-rule="evenodd"
			/>
		</svg>
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
			<XMarkIcon class="size-4" />
		</button>
	{/if}
</div>
