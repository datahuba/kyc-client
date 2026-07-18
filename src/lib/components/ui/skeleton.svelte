<script lang="ts">
	/**
	 * Skeleton — Placeholder con shimmer animation estilo iOS/Material 3.
	 *
	 * @example
	 *   <Skeleton variant="text" />          // Una línea de texto
	 *   <Skeleton variant="circle" size="48" />  // Avatar
	 *   <Skeleton variant="rect" height="120" />  // Card
	 *   <Skeleton variant="block" lines={3} />  // Bloque con varias líneas
	 */
	interface Props {
		variant?: 'text' | 'circle' | 'rect' | 'block';
		width?: string;
		height?: string;
		size?: string; // para circle
		lines?: number; // para block
		class?: string;
	}

	let {
		variant = 'text',
		width = '100%',
		height,
		size = '1rem',
		lines = 1,
		class: className = '',
	}: Props = $props();

	const variantClasses = {
		text: 'h-3 rounded',
		circle: 'rounded-full',
		rect: 'rounded-lg',
		block: 'space-y-2',
	};
</script>

{#if variant === 'block'}
	<div class={`${variantClasses.block} ${className}`} role="status" aria-label="Cargando...">
		{#each Array(lines) as _, i (i)}
			<div
				class="h-3 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] animate-shimmer"
				style="width: {i === lines - 1 && lines > 1 ? '75%' : '100%'};"
			></div>
		{/each}
	</div>
{:else}
	<div
		class={`${variantClasses[variant]} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] animate-shimmer ${className}`}
		style="
			width: {variant === 'circle' ? size : width};
			height: {variant === 'circle' ? size : (height ?? '0.75rem')};
		"
		role="status"
		aria-label="Cargando..."
	></div>
{/if}

<style>
	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
	:global(.animate-shimmer) {
		animation: shimmer 1.5s ease-in-out infinite;
	}
</style>
