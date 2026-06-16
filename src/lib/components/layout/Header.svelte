<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { Menu2Icon, UserIcon } from '$lib/icons/outline';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { apiKyC } from '$lib/config/apiKyC.config'; // IMPORTACIÓN DEL CLIENTE ESTÁNDAR

	interface Props {
		onOpenSidebar: () => void;
	}

	let { onOpenSidebar }: Props = $props();

	let user = $derived($userStore.user);
	let loginType = $derived($userStore.loginType);
	let academicRole = $derived($userStore.academicRole);

	// Estados reactivos del buzón de notificaciones (Svelte 5 - Runas)
	let notifications = $state<any[]>([]);
	let unreadCount = $state<number>(0);
	let isNotificationsOpen = $state(false);
	let notificationsLoading = $state(false);
	let pollInterval: any;

	// Referencias de elementos para el cierre click-outside
	let notificationContainerEl = $state<HTMLDivElement | null>(null);
	let profileContainerEl = $state<HTMLDivElement | null>(null);

	function getUserTypeLabel(): string {
		if (loginType === 'academic') {
			return academicRole === 'teacher' ? 'Docente' : 'Estudiante';
		}
		return 'Administrativo';
	}
	
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

	// Lógica asíncrona de notificaciones
	async function loadNotificationsSummary() {
		if (!user) return;
		try {
			// Consultar conteo de alertas no leídas
			const countRes = await apiKyC.get<{ unread_count: number }>('/notifications/unread-count');
			unreadCount = countRes.unread_count;

			// Si el dropdown está abierto, refrescar la lista
			if (isNotificationsOpen) {
				await fetchNotificationsList();
			}
		} catch (err) {
			console.error('Error loading notifications summary:', err);
		}
	}

	async function fetchNotificationsList() {
		notificationsLoading = true;
		try {
			const list = await apiKyC.get<any[]>('/notifications?limit=10');
			notifications = list;
		} catch (err) {
			console.error('Error fetching notifications list:', err);
		} finally {
			notificationsLoading = false;
		}
	}

	async function markAsRead(id: string) {
		try {
			await apiKyC.patch(`/notifications/${id}/read`, {});
			// Actualización optimista de la UI antes de refrescar
			notifications = notifications.map(n => (n._id === id || n.id === id) ? { ...n, leido: true } : n);
			await loadNotificationsSummary();
		} catch (err) {
			console.error('Error marking notification as read:', err);
		}
	}

	async function markAllAsRead() {
		try {
			await apiKyC.post('/notifications/read-all', {});
			notifications = notifications.map(n => ({ ...n, leido: true }));
			unreadCount = 0;
			await loadNotificationsSummary();
		} catch (err) {
			console.error('Error marking all as read:', err);
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
	}

	// Cerrar dropdowns al hacer clic fuera de ellos (Click-Outside nativo)
	function handleWindowClick(event: MouseEvent) {
		const target = event.target as Node;
		
		if (isNotificationsOpen && notificationContainerEl && !notificationContainerEl.contains(target)) {
			isNotificationsOpen = false;
		}
		
		if (isProfileOpen && profileContainerEl && !profileContainerEl.contains(target)) {
			isProfileOpen = false;
		}
	}

	// Svelte 5: Observar apertura de notificaciones para cargar la lista
	$effect(() => {
		if (isNotificationsOpen && user) {
			fetchNotificationsList();
		}
	});

	onMount(() => {
		if (user) {
			loadNotificationsSummary();
			// Polling suave en segundo plano cada 45 segundos
			pollInterval = setInterval(loadNotificationsSummary, 45000);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('click', handleWindowClick);
		}
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
		if (typeof window !== 'undefined') {
			window.removeEventListener('click', handleWindowClick);
		}
	});
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
		<div class="flex flex-1 items-center">
			<span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
				{getUserTypeLabel()}
			</span>
		</div>
		<div class="flex items-center gap-x-4 lg:gap-x-6">
			
			<!-- BUZÓN DE NOTIFICACIONES (ISSUE-U-BUZON) -->
			{#if user}
				<div class="relative" bind:this={notificationContainerEl}>
					<button 
						type="button" 
						class="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 transition-colors"
						onclick={() => { isNotificationsOpen = !isNotificationsOpen; isProfileOpen = false; }}
					>
						<span class="sr-only">Ver notificaciones</span>
						<!-- Campana SVG de Tailwind CSS -->
						<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
						</svg>
						{#if unreadCount > 0}
							<span class="absolute top-2.5 right-2.5 flex h-2 w-2">
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
								<span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
							</span>
						{/if}
					</button>

					{#if isNotificationsOpen}
						<div class="absolute right-0 z-50 mt-2.5 w-80 origin-top-right rounded-lg bg-white dark:bg-gray-900 py-2 shadow-lg ring-1 ring-gray-900/5 dark:ring-gray-800 focus:outline-none border border-gray-100 dark:border-gray-800">
							<div class="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
								<span class="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Notificaciones</span>
								{#if unreadCount > 0}
									<button 
										type="button" 
										onclick={markAllAsRead}
										class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
									>
										Marcar todo como leído
									</button>
								{/if}
							</div>

							<div class="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
								{#if notificationsLoading}
									<div class="flex justify-center items-center py-6">
										<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
									</div>
								{:else if notifications.length === 0}
									<div class="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
										No tienes notificaciones
									</div>
								{:else}
									{#each notifications as item (item._id || item.id)}
										<button
											type="button"
											onclick={() => markAsRead(item._id || item.id)}
											class="w-full text-left px-4 py-3 text-xs flex gap-x-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 { !item.leido ? 'bg-blue-50/40 dark:bg-blue-900/10' : '' }"
										>
											<!-- Indicador de severidad de la alerta -->
											<div class="mt-0.5 shrink-0">
												{#if item.tipo_alerta === 'success'}
													<span class="size-2 rounded-full bg-green-500 inline-block"></span>
												{:else if item.tipo_alerta === 'warning'}
													<span class="size-2 rounded-full bg-amber-500 inline-block"></span>
												{:else if item.tipo_alerta === 'error'}
													<span class="size-2 rounded-full bg-red-500 inline-block"></span>
												{:else}
													<span class="size-2 rounded-full bg-blue-500 inline-block"></span>
												{/if}
											</div>
											<div class="flex-1">
												<p class="text-gray-900 dark:text-white { !item.leido ? 'font-bold' : 'font-medium' }">
													{item.titulo}
												</p>
												<p class="text-gray-500 dark:text-gray-400 mt-0.5 break-words">
													{item.mensaje}
												</p>
												<span class="text-[9px] text-gray-400 mt-1 block">
													{formatTime(item.created_at)}
												</span>
											</div>
										</button>
									{/each}
								{/if}
							</div>
						</div>
					{/if}
				</div>
				
				<!-- Divisor vertical visual de diseño -->
				<div class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-800" aria-hidden="true"></div>
			{/if}

			<!-- Profile dropdown -->
			<div class="relative" bind:this={profileContainerEl}>
				<button 
					type="button" 
					class="-m-1.5 flex items-center p-1.5" 
					id="user-menu-button" 
					aria-expanded="false" 
					aria-haspopup="true"
					onclick={() => { isProfileOpen = !isProfileOpen; isNotificationsOpen = false; }}
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
