<script lang="ts">
	// toggle.svelte
	// Switch on/off compartido. Extraído del toggle "Cálculo Auto/Manual" de
	// CourseForm (estaba hecho a mano, sin componente reutilizable) para que
	// cualquier formulario con una alternancia binaria (no un simple check)
	// use el mismo patrón visual.
	interface Props {
		checked?: boolean;
		label?: string;
		labelOn?: string;
		labelOff?: string;
		disabled?: boolean;
		id?: string;
		class?: string;
		onchange?: (checked: boolean) => void;
	}

	let {
		checked = $bindable(false),
		label,
		labelOn,
		labelOff,
		disabled = false,
		id,
		class: className = '',
		onchange
	}: Props = $props();

	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}

	const displayLabel = $derived(label ?? (checked ? labelOn : labelOff));
</script>

<label
	for={id}
	class="inline-flex cursor-pointer items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-dark-border dark:bg-dark-surface dark:hover:bg-dark-four {disabled
		? 'cursor-not-allowed opacity-60'
		: ''} {className}"
>
	<button
		type="button"
		{id}
		role="switch"
		aria-checked={checked}
		aria-label={displayLabel ?? 'Alternar'}
		{disabled}
		onclick={toggle}
		class="relative flex h-5 w-10 shrink-0 items-center rounded-full p-1 duration-300 ease-in-out {checked
			? 'bg-primary-500'
			: 'bg-gray-300 dark:bg-gray-600'}"
	>
		<span
			class="h-4 w-4 transform rounded-full bg-white shadow-md duration-300 ease-in-out {checked
				? 'translate-x-4'
				: ''}"
		></span>
	</button>
	{#if displayLabel}
		<span
			class="text-xs font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap select-none dark:text-gray-300"
		>
			{displayLabel}
		</span>
	{/if}
</label>
