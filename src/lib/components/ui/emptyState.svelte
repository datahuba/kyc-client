<!--
	EmptyState — Componente compartido para estados vacíos (ISS-004)

	Uso típico en listados (payments, students, enrollments, courses, discounts):

		<EmptyState
			title="No se encontraron pagos"
			description="Cuando registres un pago o limpies los filtros, aparecerá aquí."
			icon="payment"
			variant="bordered"
			ctaLabel="Limpiar filtros"
			onCta={resetFilters}
		/>

	Props:
	- title       (string, requerido)            — texto principal.
	- description (string, opcional)             — texto secundario complementario.
	- icon        (Snippet | 'payment' | 'student' | 'enrollment' | 'course' | 'discount' | 'inbox' | 'search')
	- variant     ('simple' | 'bordered' | 'subtle')  default 'bordered'
	- ctaLabel / onCta                           — botón principal opcional.
	- secondaryLabel / onSecondary               — segundo botón opcional.
	- size        ('sm' | 'md' | 'lg')           default 'md'
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet | 'payment' | 'student' | 'enrollment' | 'course' | 'discount' | 'inbox' | 'search' | 'check' | 'warning';
		variant?: 'simple' | 'bordered' | 'subtle';
		size?: 'sm' | 'md' | 'lg';
		ctaLabel?: string;
		onCta?: () => void;
		secondaryLabel?: string;
		onSecondary?: () => void;
		class?: string;
	}

	let {
		title,
		description,
		icon = 'inbox',
		variant = 'bordered',
		size = 'md',
		ctaLabel,
		onCta,
		secondaryLabel,
		onSecondary,
		class: className = ''
	}: Props = $props();

	// Snippet de icono (se renderiza solo si NO se pasó un Snippet custom)
	const iconSnippets: Record<string, string> = {
		payment:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5z" /></svg>',
		student:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 9h3.75M15 12h3.75m-3.75 3H15m-3.75-9h.008v.008H11.25V9zm0 3h.008v.008H11.25V12zm0 3h.008v.008H11.25V15zM4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 4.5 6.75v10.5A2.25 2.25 0 0 0 6.75 19.5z" /></svg>',
		enrollment:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5l1.5 1.5 3-3M6.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25V9.621c0-.596-.237-1.169-.659-1.591l-5.871-5.872A2.25 2.25 0 0 0 11.379 2.25H6.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25z" /></svg>',
		course:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>',
		discount:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 6h.008v.008H6V6z" /></svg>',
		inbox:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661z" /></svg>',
		search:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" /></svg>',
		check:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>',
		warning:
			'<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>'
	};

	const variantClasses = {
		simple: '',
		bordered:
			'border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl',
		subtle: 'bg-gray-50/50 dark:bg-gray-800/30 rounded-lg'
	};

	// Mobile-first responsive: cada size se adapta al breakpoint.
	// En sm (mobile) reduce padding y tamaño del ícono; en sm: vuelve al normal.
	const sizeClasses = {
		sm: 'py-5 px-3 sm:py-6 sm:px-4',
		md: 'py-8 px-4 sm:py-10 sm:px-6',
		lg: 'py-10 px-5 sm:py-16 sm:px-8'
	};
</script>

<div
	role="status"
	class={`flex flex-col items-center justify-center text-center w-full max-w-full overflow-hidden ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
>
	<div
		class="mb-3 sm:mb-4 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 size-12 sm:size-16"
		aria-hidden="true"
	>
		{#if typeof icon === 'string' && iconSnippets[icon]}
			<div class="scale-[0.75] sm:scale-100 [&_svg]:size-10 sm:[&_svg]:size-12">
				{@html iconSnippets[icon]}
			</div>
		{:else}
			<svg class="size-10 sm:size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661z" />
			</svg>
		{/if}
	</div>

	<h3 class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white px-2">
		{title}
	</h3>

	{#if description}
		<p class="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md px-2">
			{description}
		</p>
	{/if}

	{#if ctaLabel || secondaryLabel}
		<div class="mt-4 sm:mt-5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 sm:gap-3 w-full px-2 sm:px-0">
			{#if ctaLabel && onCta}
				<button
					type="button"
					onclick={onCta}
					class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 active:scale-95 sm:hover:shadow-md w-full sm:w-auto"
				>
					{ctaLabel}
				</button>
			{/if}
			{#if secondaryLabel && onSecondary}
				<button
					type="button"
					onclick={onSecondary}
					class="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 active:scale-95 w-full sm:w-auto"
				>
					{secondaryLabel}
				</button>
			{/if}
		</div>
	{/if}
</div>
