<script lang="ts">
	import { XIcon } from '$lib/icons/outline';
	import BlurOverlay from './blurOverlay.svelte';
	import Button from './button.svelte';
	import Heading from './heading.svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isOpen: boolean;
		title: string;
		onClose: () => void;
		children?: any;
		maxWidth?: string;
		/** Mostrar drag handle en mobile (default: true) */
		showHandle?: boolean;
		/** Mostrar botón X de cerrar (default: true) */
		showCloseButton?: boolean;
	}

	let {
		isOpen,
		title,
		onClose,
		children,
		maxWidth = 'sm:max-w-2xl',
		showHandle = true,
		showCloseButton = true,
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm cursor-default"
		onclick={onClose}
		aria-label="Cerrar modal"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Bottom Sheet (mobile) / Modal (desktop) -->
	<div
		class="fixed z-50 bg-white dark:bg-dark-surface shadow-2xl flex flex-col
			inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl
			sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85vh] sm:w-full
			{maxWidth}"
		style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
	>
		<!-- Drag handle (solo mobile) -->
		{#if showHandle}
			<div class="sm:hidden flex justify-center pt-2.5 pb-1.5" aria-hidden="true">
				<div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
			</div>
		{/if}

		<!-- Header -->
		<div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center gap-3">
			<Heading level="h5" id="modal-title">{title}</Heading>
			{#if showCloseButton}
				<button
					type="button"
					class="p-2 -mr-2 text-gray-500 dark:text-gray-400 active:scale-90 transition-transform bg-gray-100 dark:bg-gray-800 rounded-full shrink-0"
					onclick={onClose}
					aria-label="Cerrar"
				>
					<XIcon class="size-5" />
				</button>
			{/if}
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 scrollbar-hide">
			{@render children?.()}
		</div>
	</div>
{/if}

<style>
	.scrollbar-hide::-webkit-scrollbar { display: none; }
	.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
