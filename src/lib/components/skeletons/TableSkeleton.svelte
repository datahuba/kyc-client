<script lang="ts">
	import Card from '$lib/components/ui/card.svelte';

	interface Props {
		rows?: number;
		columns?: number;
	}

	let { rows = 5, columns = 5 }: Props = $props();
</script>

<div class="animate-pulse space-y-4">
	<!-- Desktop Table Skeleton -->
	<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
		<div class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-6 py-3">
			<div class="flex justify-between">
				{#each Array(columns) as _}
					<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
				{/each}
			</div>
		</div>
		<div class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each Array(rows) as _}
				<div class="px-6 py-4 flex justify-between items-center">
					{#each Array(columns) as _}
						<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Mobile Cards Skeleton -->
	<div class="md:hidden grid grid-cols-1 gap-4">
		{#each Array(rows) as _}
			<Card>
				<div class="flex justify-between items-center mb-4">
					<div class="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
					<div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
				</div>
				<div class="space-y-3">
					<div class="flex justify-between">
						<div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
					</div>
					<div class="flex justify-between">
						<div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
					</div>
					<div class="flex justify-between">
						<div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
					</div>
				</div>
			</Card>
		{/each}
	</div>
</div>
