<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Component } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		icon?: Component;
		label?: string;
		error?: string;
		value?: string | number | null | undefined;
		files?: FileList;
	}

	let { class: className, icon, label, error, value = $bindable(), files = $bindable(), ...restProps }: Props = $props();
</script>

<div class={className}>
	{#if label}
		<label
			for={restProps.id}
			class="grid grid-cols-[auto,_1fr] items-center gap-0.5 text-sm leading-6 font-medium text-gray-700 dark:text-gray-300 sm:text-base"
		>
			<span class="truncate"
				>{label} <span class="text-light-error">{restProps.required ? '*' : ''} </span></span
			>
		</label>
	{/if}
	<div class="relative {label && 'mt-1'}  {icon && 'grid grid-cols-1'}">
		{#if restProps.type === 'file'}
			<input
				type="file"
				{...restProps}
				bind:files
				class="block w-full rounded-lg border border-light-four bg-white dark:border-dark-border dark:bg-dark-surface py-2 px-3 text-sm text-light-black dark:text-dark-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-base sm:leading-6 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-dark-four dark:file:text-dark-tertiary {icon &&
					'col-start-1 row-start-1 pl-10'} "
			/>
		{:else}
			<input
				{...restProps}
				bind:value
				class="block w-full rounded-lg border border-light-four bg-white dark:border-dark-border dark:bg-dark-surface py-2 px-3 text-sm text-light-black dark:text-dark-white transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-base sm:leading-6 {icon &&
					'col-start-1 row-start-1 pl-10'} "
			/>
		{/if}
		{#if icon}
			<p class="pointer-events-none col-start-1 row-start-1 ml-3 self-center text-gray-400">
				{#await Promise.resolve(icon) then Icon}
					<Icon />
				{/await}
			</p>
		{/if}
		{#if error}
			<p transition:slide={{ duration: 300, easing: cubicOut }} class="mt-1 text-sm text-light-error">
				{error}
			</p>
		{/if}
	</div>
</div>

<!-- <script lang="ts">
	//input.svelte
	interface Props {
		value: string | number | null | undefined;
		label?: string;
		id?: string;
		type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | 'textarea';
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string | null;
		rows?: number;
		callback?: (value: string | number | null | undefined) => void;
	}

	let {
		value = $bindable(),
		label = '',
		id,
		type = 'text',
		placeholder = '',
		required = false,
		disabled = false,
		error = null,
		rows = 3,
		callback
	}: Props = $props();
	id = label.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		value = target.value;
		callback?.(value);
	}

	const baseInputClasses =
		'block w-full rounded-md border-light-four dark:border-dark-four shadow-sm focus:border-light-four_d dark:focus:border-dark-four_d focus:ring-light-four_d dark:focus:ring-dark-four_d sm:text-sm disabled:cursor-not-allowed disabled:bg-light-one disabled:text-light-four outline outline-1 -outline-offset-1 outline-light-four dark:outline-dark-four placeholder:text-light-four_d focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-light-two dark:focus:outline-dark-two sm:text-sm/6';
	const errorInputClasses = 'border-red-500 focus:border-red-600 focus:ring-red-600';
	const normalInputClasses = 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500';

	let inputClasses = `${baseInputClasses} ${error ? errorInputClasses : normalInputClasses}`;
</script>

<div class="w-full">
	{#if label}
		<label for={id} class="mb-1 block text-sm font-medium text-light-two dark:text-dark-two"
			>{label}</label
		>
	{/if}

	{#if type === 'textarea'}
		<textarea
			{id}
			name={id}
			{placeholder}
			{required}
			{disabled}
			{rows}
			class="{inputClasses} px-3 py-2"
			bind:value
			oninput={handleInput}
			aria-invalid={!!error}
			aria-describedby={error ? `${id}-error` : undefined}
		></textarea>
	{:else}
		<input
			{type}
			{id}
			name={id}
			{placeholder}
			{required}
			{disabled}
			class="{inputClasses} px-3 py-2 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-light-two sm:text-sm/6"
			bind:value
			oninput={handleInput}
			aria-invalid={!!error}
			aria-describedby={error ? `${id}-error` : undefined}
		/>
	{/if}

	{#if error}
		<p id="{id}-error" class="mt-1 text-xs text-red-600">{error}</p>
	{/if}
</div> -->
