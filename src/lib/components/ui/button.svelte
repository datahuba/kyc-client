<script lang="ts">
	import { LoaderIcon } from '$lib/icons/outline';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
	type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

	interface Props {
		children?: Snippet;
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		leftIcon?: Snippet;
		rightIcon?: Snippet;
		class?: string;
		href?: string;
		target?: HTMLAnchorAttributes['target'];
		rel?: HTMLAnchorAttributes['rel'];
		type?: HTMLButtonAttributes['type'];
		onclick?: (event: MouseEvent) => void;
		[key: string]: any;
	}

	let {
		children,
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		leftIcon,
		rightIcon,
		class: className = '',
		href,
		target,
		rel,
		type = 'button',
		onclick,
		...restProps
	}: Props = $props();

	const styles = {
		base: [
			'relative',
			'inline-flex items-center justify-center',
			'font-medium select-none',
			'transition-all duration-200 ease-out',
			'focus:outline-none focus:ring-2 focus:ring-offset-2',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			'active:scale-95 transform-gpu',
			'touch-manipulation'
		].join(' '),

		variants: {
			primary:
				'bg-light-secondary text-light-white dark:text-dark-white hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d active:bg-light-secondary_d dark:hover:bg-dark-secondary_d focus:ring-light-secondary shadow-md hover:shadow-lg',
			secondary:
				'bg-light-background border border-light-secondary text-light-secondary dark:text-dark-secundary hover:bg-light-primary_d dark:hover:bg-dark-primary_d active:bg-light-primary_d dark:hover:bg-dark-primary_d focus:ring-light-secondary shadow-sm',
			outline:
				'bg-transparent text-light-secondary dark:text-dark-secondary border border-light-four active:bg-light-primary_d dark:hover:bg-dark-primary_d focus:ring-light-four_d',
			ghost:
				'bg-transparent text-light-secundary dark:text-dark-secundary hover:bg-light-primary_d dark:hover:bg-dark-primary_d active:bg-light-primary_d dark:hover:bg-dark-primary_d focus:ring-light-four_d',
			destructive:
				'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-md hover:shadow-lg',
			link: 'bg-transparent text-light-text-light-secundary dark:text-dark-secundary p-0 hover:text-light-secundary_d hover:underline focus:ring-light-secundary_d underline-offset-4'
		},

		sizes: {
			xs: 'px-2.5 py-1.5 text-xs min-h-[32px] gap-1.5 rounded-md',
			sm: 'px-3 py-2 text-sm min-h-[36px] gap-2 rounded-md',
			md: 'px-4 py-2.5 text-base min-h-[44px] gap-2 rounded-lg',
			lg: 'px-6 py-3 text-lg min-h-[52px] gap-2.5 rounded-lg',
			xl: 'px-8 py-4 text-xl min-h-[60px] gap-3 rounded-xl'
		},

		iconSizes: {
			xs: 'p-1.5 text-xs min-h-[32px] rounded-md',
			sm: 'p-2 text-sm min-h-[36px] rounded-md',
			md: 'p-2.5 text-base min-h-[44px] rounded-lg',
			lg: 'p-3 text-lg min-h-[52px] rounded-lg',
			xl: 'p-4 text-xl min-h-[60px] rounded-xl'
		}
	} as const;

	const isLink = $derived(!!href);
	const isDisabled = $derived(disabled || loading);
	const isIconOnly = $derived(!children && (!!leftIcon || !!rightIcon));

	if (isIconOnly && !restProps['aria-label']) {
		console.warn(
			`Accesibility Warning: An icon-only button should have an 'aria-label' prop to be accessible to screen readers.`
		);
	}

	const buttonClasses = $derived(
		[
			styles.base,
			styles.variants[variant],
			isIconOnly ? styles.iconSizes[size] : styles.sizes[size],
			fullWidth && 'w-full',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	function handleClick(event: MouseEvent) {
		if (isDisabled) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		onclick?.(event);
	}

	const commonProps = $derived({
		class: buttonClasses,
		'aria-disabled': isDisabled,
		'aria-busy': loading,
		tabindex: isDisabled ? -1 : undefined
	});
</script>

{#if isLink}
	<a
		{...commonProps}
		href={isDisabled ? undefined : href}
		{target}
		{rel}
		role="button"
		onclick={handleClick}
		{...restProps}
	>
		{@render buttonContent()}
	</a>
{:else}
	<button {...commonProps} {type} disabled={isDisabled} onclick={handleClick} {...restProps}>
		{@render buttonContent()}
	</button>
{/if}

{#snippet buttonContent()}
	{#if loading}
		<span class="absolute inset-0 flex items-center justify-center" aria-label="Cargando...">
			<LoaderIcon class="h-5 w-5 animate-spin" />
		</span>
	{/if}

	{#if leftIcon}
		<span aria-hidden="true" class:invisible={loading}>
			{@render leftIcon()}
		</span>
	{/if}

	{#if children}
		<span class:invisible={loading}>
			{@render children()}
		</span>
	{/if}

	{#if rightIcon}
		<span aria-hidden="true" class:invisible={loading}>
			{@render rightIcon()}
		</span>
	{/if}
{/snippet}
