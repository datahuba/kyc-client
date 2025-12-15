<script lang="ts">
	import type { DropdownOption } from '$lib/interfaces';
	import { clickOutside } from '$lib/utils';
	import { scale } from 'svelte/transition';

	interface Props {
		options: DropdownOption[];
		width: string;
		class: string;
		isOpen: boolean;
	}

	let { options, width, class: className, isOpen }: Props = $props();

	function handleSelect(option: DropdownOption) {
		if (option.disabled) return;
		if (option.action) {
			option.action();
		}
		close();
	}

	function close(): void {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div
		use:clickOutside={() => close()}
		class="z-20 rounded-md bg-light-primary shadow-lg ring-1 ring-light-four focus:outline-none {className}"
		role="menu"
		aria-orientation="vertical"
		tabindex="-1"
		style="width: {width};"
		transition:scale={{ duration: 120, start: 0.95, opacity: 0 }}
	>
		{#each options as option, i}
			{#if option.divider && i > 0}
				<div class="border-t border-light-four"></div>
			{/if}
			<div class="py-1" role="none">
				<button
					class={`group flex w-full items-center px-4 py-2 text-sm ${option.disabled ? 'cursor-not-allowed text-light-secondary' : 'text-light-secondary hover:bg-light-one_d hover:text-light-secondary_d'}`}
					role="menuitem"
					tabindex="-1"
					onclick={() => handleSelect(option)}
					disabled={option.disabled}
				>
					{#if option.icon}
						<span class="mr-3 size-5 text-light-secondary group-hover:text-light-secondary_d">
							{@html option.icon}
						</span>
					{/if}
					{option.label}
				</button>
			</div>
		{/each}
	</div>
{/if}
