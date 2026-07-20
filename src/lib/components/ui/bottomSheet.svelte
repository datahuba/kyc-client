<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	/**
	 * BottomSheet — Modal nativo iOS/Material para mobile, modal centrado en desktop.
	 *
	 * Comportamiento:
	 * - <md (mobile): slide-up desde abajo con drag handle visual
	 * - ≥md (desktop): modal centrado (comportamiento clásico)
	 *
	 * @example
	 *   <BottomSheet bind:open={showModal} title="Crear estudiante">
	 *     <form>...</form>
	 *   </BottomSheet>
	 */
	interface Props {
		open: boolean;
		onClose?: () => void;
		title?: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
		showHandle?: boolean;
		showCloseButton?: boolean;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		children?: import('svelte').Snippet;
	}

	let {
		open = $bindable(false),
		onClose,
		title,
		description,
		size = 'md',
		showHandle = true,
		showCloseButton = true,
		closeOnBackdrop = true,
		closeOnEscape = true,
		children,
	}: Props = $props();

	let sheetRef = $state<HTMLDivElement | null>(null);
	let startY = $state(0);
	let currentY = $state(0);
	let isDragging = $state(false);
	let dragOffset = $state(0);

	function close() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && closeOnEscape && e.key === 'Escape') {
			close();
		}
	}

	function handleBackdropClick() {
		if (closeOnBackdrop) close();
	}

	// Drag-to-dismiss (solo mobile, solo si hay handle)
	function onDragStart(e: TouchEvent | MouseEvent) {
		if (window.innerWidth >= 768) return; // solo mobile
		if (!showHandle) return;
		isDragging = true;
		startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		currentY = startY;
	}

	function onDragMove(e: TouchEvent | MouseEvent) {
		if (!isDragging) return;
		currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		const diff = currentY - startY;
		// Solo permitir arrastrar hacia abajo
		dragOffset = Math.max(0, diff);
	}

	function onDragEnd() {
		if (!isDragging) return;
		isDragging = false;
		// Si arrastró más de 100px, cerrar
		if (dragOffset > 100) {
			close();
		}
		dragOffset = 0;
	}

	$effect(() => {
		if (open) {
			// Bloquear scroll del body
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	});

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('mousemove', onDragMove);
		window.addEventListener('mouseup', onDragEnd);
		window.addEventListener('touchmove', onDragMove, { passive: true });
		window.addEventListener('touchend', onDragEnd);
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') document.body.style.overflow = '';
		window.removeEventListener('keydown', handleKeydown);
		window.removeEventListener('mousemove', onDragMove);
		window.removeEventListener('mouseup', onDragEnd);
		window.removeEventListener('touchmove', onDragMove);
		window.removeEventListener('touchend', onDragEnd);
	});

	const sizeClasses: Record<string, string> = {
		sm: 'sm:max-w-sm',
		md: 'sm:max-w-md',
		lg: 'sm:max-w-lg',
		xl: 'sm:max-w-2xl',
		full: 'sm:max-w-[95vw]',
	};
</script>

{#if open}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm cursor-default"
		onclick={handleBackdropClick}
		aria-label="Cerrar"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Bottom Sheet (mobile) / Modal (desktop) -->
	<div
		bind:this={sheetRef}
		class="fixed z-50 bg-white dark:bg-gray-900 shadow-2xl flex flex-col
			inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl
			sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85vh] sm:w-full
			{sizeClasses[size] ?? sizeClasses.md}"
		style="transform: {isDragging ? `translateY(${dragOffset}px)` : ''};
			{isDragging && window.innerWidth < 768 ? `transform: translateY(${dragOffset}px); transition: none;` : ''}
			padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);"
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'bottom-sheet-title' : undefined}
		transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
	>
		<!-- Drag handle (solo mobile) -->
		{#if showHandle}
			<div
				class="sm:hidden flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none"
				onmousedown={onDragStart}
				ontouchstart={onDragStart}
				role="button"
				tabindex="-1"
				aria-label="Arrastrar para cerrar"
			>
				<div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
			</div>
		{/if}

		<!-- Header -->
		{#if title || showCloseButton}
			<div class="px-5 pb-3 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 sm:px-6 sm:pt-5">
				<div class="flex-1 min-w-0">
					{#if title}
						<h2 id="bottom-sheet-title" class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
							{title}
						</h2>
					{/if}
					{#if description}
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
					{/if}
				</div>
				{#if showCloseButton}
					<button
						type="button"
						onclick={close}
						class="p-2 -mr-2 text-gray-500 dark:text-gray-400 active:scale-90 transition-transform bg-gray-100 dark:bg-gray-800 rounded-full shrink-0"
						aria-label="Cerrar"
					>
						<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		<!-- Content -->
		<div class="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5 scrollbar-hide">
			{@render children?.()}
		</div>
	</div>
{/if}

<style>
	.scrollbar-hide::-webkit-scrollbar { display: none; }
	.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
