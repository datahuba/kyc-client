<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLSelectAttributes, 'children'> {
		children: Snippet;
		icon?: Snippet;
		label?: string;
		error?: string;
		class?: string;
		value?: string | number | null | undefined;
	}

	let {
		class: className,
		children,
		icon,
		label,
		error,
		value = $bindable(),
		...restProps
	}: Props = $props();
</script>

<div class={className}>
	{#if label}
		<label
			class="relative mb-1 grid grid-cols-[auto,_1fr] items-center gap-0.5 text-sm leading-6 font-medium text-gray-700 dark:text-gray-300 sm:text-base"
			for={restProps.id}
			><span class="truncate"
				>{label} <span class="text-light-error">{restProps.required ? '*' : ''} </span></span
			>
		</label>
	{/if}
	<div class={icon && 'grid grid-cols-1'}>
		<select
			{...restProps}
			bind:value
			class="block w-full rounded-lg border border-light-four bg-white dark:border-dark-border dark:bg-dark-surface py-2 px-3 text-sm text-light-black dark:text-dark-white transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-base sm:leading-6 {icon &&
				'col-start-1 row-start-1 pl-10'}"
		>
			{@render children()}
		</select>
		{#if icon}
			<p class="pointer-events-none col-start-1 row-start-1 ml-3 self-center text-gray-400">
				{@render icon()}
			</p>
		{/if}
		{#if error}
			<p transition:slide={{ duration: 300, easing: cubicOut }} class="mt-1 text-sm text-light-error">
				{error}
			</p>
		{/if}
	</div>
</div>
