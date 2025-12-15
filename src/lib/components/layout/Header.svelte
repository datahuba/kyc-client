<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { Menu2Icon, UserIcon } from '$lib/icons/outline';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import { goto } from '$app/navigation';

	interface Props {
		onOpenSidebar: () => void;
	}

	let { onOpenSidebar }: Props = $props();

	let user = $derived($userStore.user);
	
	function getProfileOptions() {
		return [
			{
				label: 'Mi Perfil',
        id: 'profile',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>`,
				action: () => goto('/app/profile')
			},
			{
				label: 'Cerrar Sesión',
        id: 'logout',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>`,
				action: () => logout(),
				divider: true
			}
		];
	}

	let isProfileOpen = $state(false);

	const logout = () => {
		userStore.logout();
		goto('/auth/sign-in');
	}
</script>

<div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
	<button 
		type="button" 
		class="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 lg:hidden"
		onclick={onOpenSidebar}
	>
		<span class="sr-only">Abrir sidebar</span>
		<Menu2Icon class="size-6" />
	</button>

	<div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
		<div class="flex flex-1"></div>
		<div class="flex items-center gap-x-4 lg:gap-x-6">
			<!-- Profile dropdown -->
			<div class="relative">
				<button 
					type="button" 
					class="-m-1.5 flex items-center p-1.5" 
					id="user-menu-button" 
					aria-expanded="false" 
					aria-haspopup="true"
					onclick={() => isProfileOpen = !isProfileOpen}
				>
					<span class="sr-only">Abrir menú de usuario</span>
					{#if user?.foto_url}
						<img class="h-8 w-8 rounded-full bg-gray-50" src={user.foto_url} alt="" />
					{:else}
						<div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
							<UserIcon class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						</div>
					{/if}
					<span class="hidden lg:flex lg:items-center">
						<span class="ml-4 text-sm font-semibold leading-6 text-gray-900 dark:text-white" aria-hidden="true">
							{user?.username || 'Usuario'}
						</span>
					</span>
				</button>

				{#if isProfileOpen}
					<div class="absolute right-0 z-10 mt-2.5 origin-top-right">
						<DropdownMenu 
							options={getProfileOptions()} 
							isOpen={true} 
							width="w-full"
							class="w-full"
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
