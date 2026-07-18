<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface CardProps extends HTMLAttributes<HTMLDivElement> {
		// Variantes de diseño
		variant?: 'default' | 'bordered' | 'elevated' | 'ghost';

		// Tamaños: SOLO limita el ancho máximo si se especifica explícitamente.
		// Por defecto el Card ocupa el 100% del ancho de su contenedor (uso más
		// común: secciones de formulario, grids de tarjetas, tablas responsive).
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
		size,
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
	const baseClasses = 'rounded-xl transition-all duration-200 ease-in-out';

	// Variantes de estilo
	const variantClasses = {
		default: 'bg-white border border-gray-200 shadow-sm dark:bg-dark-surface dark:border-dark-border',
		bordered: 'bg-white border-2 border-gray-300 dark:bg-dark-surface dark:border-dark-border',
		elevated: 'bg-white shadow-lg border-0 dark:bg-dark-surface',
		ghost: 'bg-transparent border-0 shadow-none'
	};

	// Tamaños: mapa opcional. Sin `size`, el Card no restringe su ancho
	// (bug encontrado 2026-07-06: antes el default 'md' forzaba max-w-md en
	// TODO Card sin excepción, aplastando secciones de formulario de varias
	// columnas dentro de modales anchos — ver CourseForm/StudentForm).
	const sizeClasses: Record<string, string> = {
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

	// Estados interactivos (mobile-first: active para tap, hover solo desktop)
	const interactiveClasses =
		interactive && !disabled
			? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-background active:scale-[0.98] active:shadow-sm sm:hover:shadow-md sm:hover:-translate-y-0.5 motion-reduce:active:scale-100 motion-reduce:sm:hover:translate-y-0 transition-transform duration-150'
			: '';

	// Estado deshabilitado
	const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : '';

	// Combinamos todas las clases
	const cardClasses = [
		baseClasses,
		variantClasses[variant],
		size ? sizeClasses[size] : '',
		paddingClasses[padding],
		interactiveClasses,
		disabledClasses,
		additionalClass
	]
		.filter(Boolean)
		.join(' ');

	// Handler para clicks. El tipo del evento coincide con el que Svelte pasa al
	// onclick del <div> (incluye currentTarget tipado) para poder reenviarlo al
	// prop `onclick` sin error de tipos.
	const handleClick = (event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) => {
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
		<div class="card-header mb-4 border-b border-gray-200 pb-4 dark:border-dark-border">
			{@render header()}
		</div>
	{/if}

	<!-- Main Content -->
	<div class="card-content">
		{@render children()}
	</div>

	<!-- Footer Section -->
	{#if footer}
		<div class="card-footer mt-4 border-t border-gray-200 pt-4 dark:border-dark-border">
			{@render footer()}
		</div>
	{/if}
</div>
