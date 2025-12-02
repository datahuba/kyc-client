<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface CardProps extends HTMLAttributes<HTMLDivElement> {
		// Variantes de diseño
		variant?: 'default' | 'bordered' | 'elevated' | 'ghost';

		// Tamaños
		size?: 'sm' | 'md' | 'lg';

		// Estados
		interactive?: boolean;
		disabled?: boolean;

		// Layout
		padding?: 'none' | 'sm' | 'md' | 'lg';

		// Contenido opcional del header y footer
		header?: Snippet;
		footer?: Snippet;

		// Contenido principal (children)
		children: Snippet;

		// Props adicionales para extensibilidad
		class?: string;
	}

	let {
		variant = 'default',
		size = 'md',
		interactive = false,
		disabled = false,
		padding = 'md',
		header,
		footer,
		children,
		class: additionalClass = '',
		onclick,
		...restProps
	}: CardProps = $props();

	// Clases base del card
	const baseClasses = 'rounded-lg transition-all duration-200 ease-in-out';

	// Variantes de estilo
	const variantClasses = {
		default: 'bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800',
		bordered: 'bg-white border-2 border-gray-300 dark:bg-gray-900 dark:border-gray-700',
		elevated: 'bg-white shadow-lg border-0 dark:bg-gray-900',
		ghost: 'bg-transparent border-0 shadow-none'
	};

	// Tamaños
	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg xl:max-w-xl'
	};

	// Padding interno
	const paddingClasses = {
		none: '',
		sm: 'p-3',
		md: 'p-4 sm:p-6',
		lg: 'p-6 sm:p-8'
	};

	// Estados interactivos
	const interactiveClasses =
		interactive && !disabled
			? 'hover:shadow-md hover:scale-[1.02] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
			: '';

	// Estado deshabilitado
	const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : '';

	// Combinamos todas las clases
	const cardClasses = [
		baseClasses,
		variantClasses[variant],
		sizeClasses[size],
		paddingClasses[padding],
		interactiveClasses,
		disabledClasses,
		additionalClass
	]
		.filter(Boolean)
		.join(' ');

	// Handler para clicks
	const handleClick = (event: MouseEvent) => {
		if (disabled) return;
		onclick?.(event);
	};
</script>

<div
	class={cardClasses}
	role={interactive ? 'button' : undefined}
	tabindex={interactive && !disabled ? 0 : undefined}
	onclick={handleClick}
	onkeydown={(e) => {
		if (interactive && !disabled && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			handleClick(e as any);
		}
	}}
	{...restProps}
>
	<!-- Header Section -->
	{#if header}
		<div class="card-header mb-4 border-b border-gray-200 pb-4 dark:border-gray-700">
			{@render header()}
		</div>
	{/if}

	<!-- Main Content -->
	<div class="card-content">
		{@render children()}
	</div>

	<!-- Footer Section -->
	{#if footer}
		<div class="card-footer mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
			{@render footer()}
		</div>
	{/if}
</div>
