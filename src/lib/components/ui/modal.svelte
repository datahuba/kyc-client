<script lang="ts">
	import { XIcon } from '$lib/icons/outline';
	import BlurOverlay from './blurOverlay.svelte';
	import Button from './button.svelte';
	import Heading from './heading.svelte';

	interface Props {
		isOpen: boolean;
		title: string;
		onClose: () => void;
		children?: any;
		maxWidth?: string;
	}

	let { isOpen, title, onClose, children, maxWidth = 'sm:max-w-2xl' }: Props = $props();
</script>

{#if isOpen}
	<div
		class="relative z-50"
		role="dialog"
		aria-modal="true"
	>
		<BlurOverlay class="overflow-y-auto">
			<div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
				<div
					class={`relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full ${maxWidth}`}
				>
					<!-- Header -->
					<div class="bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
						<Heading level="h3">{title}</Heading>
						<button
							type="button"
							class="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
							onclick={onClose}
						>
							<span class="sr-only">Cerrar</span>
							<XIcon class="size-6" />
						</button>
					</div>

					<!-- Body -->
					<div class="px-4 py-5 sm:p-6">
						{@render children?.()}
					</div>
				</div>
			</div>
		</BlurOverlay>
	</div>
{/if}
