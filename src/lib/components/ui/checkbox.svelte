<script lang="ts">
	// checkbox.svelte
	// Componente compartido de checkbox, extraído para eliminar la repetición
	// de `<input type="checkbox">` con clases Tailwind a mano en múltiples
	// formularios (CourseForm, StudentForm, etc.).
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked'> {
		label?: string;
		description?: string;
		checked?: boolean;
		error?: string;
		class?: string;
	}

	let {
		class: className = '',
		label,
		description,
		checked = $bindable(false),
		error,
		...restProps
	}: Props = $props();
</script>

<div class={className}>
	<div class="flex items-start gap-2">
		<input
			type="checkbox"
			bind:checked
			{...restProps}
			class="mt-0.5 h-4 w-4 shrink-0 rounded border-light-four text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-dark-border dark:bg-dark-surface"
		/>
		{#if label}
			<label
				for={restProps.id}
				class="text-sm font-medium text-gray-700 select-none dark:text-gray-300"
			>
				{label}
			</label>
		{/if}
	</div>
	{#if description}
		<p class="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">{description}</p>
	{/if}
	{#if error}
		<p class="mt-1 ml-6 text-sm text-light-error">{error}</p>
	{/if}
</div>
