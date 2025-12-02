<script lang="ts">
	import Card from '$lib/components/ui/card.svelte';
</script>

<div class="space-y-8 animate-pulse">
	<!-- Heading Skeleton -->
	<div class="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>

	<!-- Stats Grid Skeleton -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
		{#each Array(4) as _}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
				<div class="space-y-3">
					<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
					<div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
					<div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
				</div>
				<div class="h-14 w-14 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
			</div>
		{/each}
	</div>

	<!-- Recent Activity Section Skeleton -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		{#each Array(2) as _}
			<Card>
				<div class="flex justify-between items-center mb-4">
					<div class="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
					<div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
				</div>
				<div class="space-y-4">
					<!-- Table Header -->
					<div class="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
						<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
					</div>
					<!-- Table Rows -->
					{#each Array(5) as _}
						<div class="flex justify-between py-2">
							<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
							<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
							<div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
						</div>
					{/each}
				</div>
			</Card>
		{/each}
	</div>
</div>
