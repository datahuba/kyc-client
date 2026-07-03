<script lang="ts">
	import { isDark, toggleTheme } from '$lib/stores/themeStore';

	interface Props {
		class?: string;
	}
	let { class: className = '' }: Props = $props();
</script>

<button
	type="button"
	onclick={toggleTheme}
	class={`inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-dark-tertiary ${className}`}
	title={$isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
	aria-label={$isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
>
	{#if $isDark}
		<!-- Sol (indica que al pulsar se irá a claro) -->
		<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
			/>
		</svg>
	{:else}
		<!-- Luna (indica que al pulsar se irá a oscuro) -->
		<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
			/>
		</svg>
	{/if}
</button>
