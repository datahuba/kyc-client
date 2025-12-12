<script lang="ts">
	//modalConfirm.svelte
	import { XIcon } from '$lib/icons/outline';
	import { AlertTriangleIcon } from '$lib/icons/solid';
	import BlurOverlay from './blurOverlay.svelte';
	import Button from './button.svelte';
	import Heading from './heading.svelte';

	interface Props {
		isOpen: boolean;
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
		loading?: boolean;
	}

	let { isOpen, message, onConfirm, onCancel, loading = false }: Props = $props();
</script>

{#if isOpen}
	<div
		class="relative z-50"
		onclick={(event) => {
			event.stopPropagation();
			onCancel();
		}}
	>
		<BlurOverlay class="overflow-y-auto rounded-md">
			<div
				class="relative mt-auto transform overflow-hidden rounded-lg bg-light-primary px-4 pt-5 text-left shadow-xl transition-all sm:w-full sm:max-w-lg sm:p-6 dark:bg-dark-primary"
			>
				<div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
					<Button type="button" variant="ghost" onclick={() => onCancel()}>
						{#snippet leftIcon()}
							<XIcon class="size-6" />
						{/snippet}
					</Button>
				</div>
				<div class="sm:flex sm:items-start">
					<div
						class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-light-primary text-light-three sm:mx-0 sm:size-10 dark:bg-dark-primary dark:text-dark-three"
					>
						<AlertTriangleIcon class="size-10" />
					</div>
					<div class="mt-3 text-center sm:mt-0 sm:ml-4">
						<Heading level="h2">Confirmar acción</Heading>
						<div class="mt-2">
							<p class="mt-4 text-center">{message}</p>
						</div>
					</div>
				</div>
				<div class="mt-5 flex flex-col justify-end gap-4 sm:mt-4 sm:flex-row">
					<Button type="button" onclick={() => onConfirm()} {loading} variant="primary"
						>Confirmar</Button
					>
					<Button type="button" onclick={() => onCancel()} variant="secondary">Cancelar</Button>
				</div>
			</div>
		</BlurOverlay>
	</div>
{/if}
