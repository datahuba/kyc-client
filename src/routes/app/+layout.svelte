<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	let { children } = $props();
	let sidebarOpen = $state(false);

	onMount(() => {
		// Basic auth check or restore
		if (!$userStore.isAuthenticated) {
			// Try to restore or redirect
			userStore.init();
			if (!$userStore.isAuthenticated) {
				goto('/auth/sign-in');
			}
		}
	});
</script>

<div class="flex h-screen bg-gray-100">
	<Sidebar 
		isOpen={sidebarOpen} 
		onClose={() => sidebarOpen = false} 
	/>
	<div class="flex flex-1 flex-col overflow-hidden transition-all duration-300">
		<Header onOpenSidebar={() => sidebarOpen = true} />

		<main class="flex-1 overflow-y-auto p-6">
			{@render children?.()}
		</main>
	</div>
</div>
