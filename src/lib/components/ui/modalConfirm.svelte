<script lang="ts">
	//modalConfirm.svelte — Modal de confirmación con bottom sheet nativo en mobile
	import { XIcon } from '$lib/icons/outline';
	import { AlertTriangleIcon } from '$lib/icons/solid';
	import Button from './button.svelte';
	import Heading from './heading.svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isOpen: boolean;
		message: string;
		title?: string;
		variant?: 'danger' | 'warning' | 'info';
		confirmText?: string;
		cancelText?: string;
		onConfirm: () => void;
		onCancel: () => void;
		loading?: boolean;
	}

	let {
		isOpen,
		message,
		title = 'Confirmar acción',
		variant = 'danger',
		confirmText = 'Confirmar',
		cancelText = 'Cancelar',
		onConfirm,
		onCancel,
		loading = false,
	}: Props = $props();

	const variantConfig = {
		danger: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
		warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
		info: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
	};

	function handleKeydown(e: KeyboardEvent) {
		if (isOpen && e.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm cursor-default"
		onclick={onCancel}
		aria-label="Cerrar"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Bottom Sheet (mobile) / Modal (desktop) -->
	<div
		class="fixed z-50 bg-white dark:bg-dark-surface shadow-2xl flex flex-col
			inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl
			sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85vh] sm:w-full sm:max-w-lg
		"
		style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		aria-describedby="confirm-msg"
		transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
	>
		<!-- Drag handle (solo mobile) -->
		<div class="sm:hidden flex justify-center pt-2.5 pb-1.5" aria-hidden="true">
			<div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
		</div>

		<!-- Header -->
		<div class="px-4 sm:px-6 pt-2 pb-1 flex items-start gap-3 sm:gap-4">
			<div class={`shrink-0 size-12 sm:size-10 flex items-center justify-center rounded-full ${variantConfig[variant].bg}`}>
				<AlertTriangleIcon class={`size-7 sm:size-6 ${variantConfig[variant].text}`} />
			</div>
			<div class="flex-1 min-w-0">
				<h2 id="confirm-title" class="text-lg font-bold text-gray-900 dark:text-white">
					{title}
				</h2>
				<p id="confirm-msg" class="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
					{message}
				</p>
			</div>
			<button
				type="button"
				class="p-2 -mr-2 text-gray-500 dark:text-gray-400 active:scale-90 transition-transform bg-gray-100 dark:bg-gray-800 rounded-full shrink-0"
				onclick={onCancel}
				aria-label="Cerrar"
			>
				<XIcon class="size-5" />
			</button>
		</div>

		<!-- Actions -->
		<div class="px-4 sm:px-6 pt-3 pb-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
			<Button
				type="button"
				onclick={onCancel}
				variant="secondary"
				fullWidth
				class="!sm:w-auto"
			>
				{cancelText}
			</Button>
			<Button
				type="button"
				onclick={onConfirm}
				{loading}
				variant={variant === 'danger' ? 'destructive' : 'primary'}
				fullWidth
				class="!sm:w-auto"
			>
				{confirmText}
			</Button>
		</div>
	</div>
{/if}

<style>
	.scrollbar-hide::-webkit-scrollbar { display: none; }
	.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
