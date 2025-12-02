<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLTextareaAttributes, 'children'> {
		icon?: Snippet;
		label?: string;
		error?: string;
		class?: string;
		value?: string | number | null | undefined;
	}

	let { class: className, icon, label, error, value = $bindable(), ...restProps }: Props = $props();
</script>

<div class={className}>
	<label
		for={restProps.id}
		class="mb-1 grid grid-cols-[auto,_1fr] items-center gap-0.5 text-lg leading-6 font-medium text-light-two"
	>
		<span class="truncate"
			>{label} <span class="text-red-500">{restProps.required && '*'} </span></span
		>
	</label>
	<div class="relative">
		<textarea
			{...restProps}
			bind:value
			class="block w-full resize-none rounded-md border border-light-four bg-light-one py-1.5 text-sm text-light-two transition-all outline-none placeholder:text-light-three placeholder:opacity-50 focus:ring-0 sm:text-base sm:leading-6"
		></textarea>

		{#if error}
			<p transition:slide={{ duration: 300, easing: cubicOut }} class="mt-1 text-sm text-red-500">
				{error}
			</p>
		{/if}
	</div>
</div>
