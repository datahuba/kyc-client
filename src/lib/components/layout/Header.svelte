<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { Menu2Icon, UserIcon } from '$lib/icons/outline';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import PWAInstallButton from '$lib/components/ui/PWAInstallButton.svelte';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy, untrack } from 'svelte';
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

	// Derivados reactivos para separar Nuevas de Anteriores (Historial)
	const unreadAlerts = $derived(notifications.filter(n => !n.leido));
	const readAlerts = $derived(notifications.filter(n => n.leido));

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

	// Lógica asíncrona de notificaciones (Con bandera 'silent' para evitar loaders molestos)
	async function loadNotificationsSummary(silent = false) {
		if (!user) return;
		try {
			// Consultar conteo de alertas no leídas
			const countRes = await apiKyC.get<{ unread_count: number }>('/notifications/unread-count');
			unreadCount = countRes.unread_count;

			// Si el dropdown está abierto, refrescar la lista en segundo plano
			if (isNotificationsOpen) {
				await fetchNotificationsList(silent);
			}
		} catch (err) {
			console.error('Error loading notifications summary:', err);
		}
	}

	async function fetchNotificationsList(silent = false) {
		// [ESTRATEGIA CACHE-FIRST]: Solo activamos el spinner de carga si la lista local está vacía.
		// Si ya tenemos notificaciones en memoria, las renderizamos al instante y refrescamos de forma silenciosa.
		const isFirstLoad = notifications.length === 0;
		if (isFirstLoad) {
			notificationsLoading = true;
		}
		
		try {
			// Agregada la barra diagonal final "/" para evitar el 307 Redirect en el VPS
			const list = await apiKyC.get<any[]>('/notifications/?limit=15');
			notifications = list;
		} catch (err) {
			console.error('Error fetching notifications list:', err);
		} finally {
			if (isFirstLoad) {
				notificationsLoading = false;
			}
		}
	}

	// Marcar como leído con actualización optimista de 0ms para el usuario
	async function markAsRead(id: string) {
		// 1. Cambio optimista inmediato en la UI local sin mostrar spinner de carga
		notifications = notifications.map(n => (n._id === id || n.id === id) ? { ...n, leido: true } : n);
		if (unreadCount > 0) unreadCount--;

		try {
			// 2. Enviar petición en segundo plano silencioso
			await apiKyC.patch(`/notifications/${id}/read`, {});
			
			// 3. Sincronizar conteo de manera silenciosa
			const countRes = await apiKyC.get<{ unread_count: number }>('/notifications/unread-count');
			unreadCount = countRes.unread_count;
		} catch (err) {
			console.error('Error marking notification as read:', err);
			// Rollback en caso de falla
			loadNotificationsSummary();
		}
	}

	// Marcar todas como leídas optimista e instantáneo
	async function markAllAsRead() {
		// 1. Cambio optimista inmediato
		notifications = notifications.map(n => ({ ...n, leido: true }));
		unreadCount = 0;

		try {
			// 2. Enviar petición en segundo plano silencioso
			await apiKyC.post('/notifications/read-all', {});
			
			// 3. Sincronizar conteo de manera silenciosa
			const countRes = await apiKyC.get<{ unread_count: number }>('/notifications/unread-count');
			unreadCount = countRes.unread_count;
		} catch (err) {
			console.error('Error marking all as read:', err);
			loadNotificationsSummary();
		}
	}

	// Resolver la ruta destino de una notificación.
	// 1) usa la `ruta` explícita del backend (notificaciones nuevas);
	// 2) si no, la deduce por `referencia_tipo`;
	// 3) fallback por contenido para notificaciones antiguas (sin ruta).
	function resolveNotificationRoute(item: any): string | null {
		if (item?.ruta) return item.ruta;
		if (item?.referencia_tipo === 'payment') return '/app/payments';
		if (item?.referencia_tipo === 'enrollment') return '/app/enrollments';

		const text = `${item?.titulo ?? ''} ${item?.mensaje ?? ''}`.toLowerCase();
		if (
			text.includes('pago') ||
			text.includes('matrícula') || text.includes('matricula') ||
			text.includes('cobro') ||
			text.includes('comprobante') ||
			text.includes('cuota')
		) {
			return '/app/payments';
		}
		if (text.includes('inscri')) return '/app/enrollments';
		return null;
	}

	// Click en una notificación: marcar leída (si aplica), cerrar el buzón y navegar a su flujo.
	function handleNotificationClick(item: any) {
		isNotificationsOpen = false;
		if (!item.leido) {
			markAsRead(item._id || item.id);
		}
		const ruta = resolveNotificationRoute(item);
		if (ruta) {
			goto(ruta);
		}
	}

	// Sanitizado estricto e interpretación ISO de Bolivia (UTC-4) sin importar reloj local del cliente
	function formatTime(dateStr: string): string {
		if (!dateStr) return '';
		
		// 1. Reemplazar espacio por 'T' para asegurar formato estándar ISO
		let cleanStr = dateStr.trim().replace(' ', 'T');
		
		// 2. Recortar microsegundos que confunden a algunos motores JS
		if (cleanStr.includes('.')) {
			cleanStr = cleanStr.split('.')[0];
		}
		
		// 3. Forzar sufijo 'Z' para indicar que es UTC nativo de MongoDB
		if (!cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-')) {
			cleanStr += 'Z';
		}
		
		const date = new Date(cleanStr);
		if (isNaN(date.getTime())) return dateStr;
		
		// 4. Formatear la fecha local (El navegador la convertirá automáticamente a Bolivia UTC-4)
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

	// Svelte 5: Observar apertura de notificaciones para cargar la lista.
	// `untrack` evita que la lectura de `notifications` dentro de fetchNotificationsList
	// convierta a `notifications` en dependencia del efecto (lo que provocaba un loop
	// infinito de fetch y el spinner que nunca terminaba).
	$effect(() => {
		if (isNotificationsOpen && user) {
			untrack(() => fetchNotificationsList());
		}
	});

	onMount(() => {
		if (user) {
			loadNotificationsSummary();
			pollInterval = setInterval(() => loadNotificationsSummary(true), 45000); // Refrescos de fondo silenciosos
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

<div class="sticky top-[env(safe-area-inset-top,0px)] z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-4 sm:gap-x-6 sm:px-6 lg:px-8 pt-[env(safe-area-inset-top,0px)] transition-colors">

	<div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
		<div class="flex flex-1 items-center">
			<span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
				{getUserTypeLabel()}
			</span>
		</div>
		<div class="flex items-center gap-x-4 lg:gap-x-6">

			<!-- PWA INSTALL BUTTON -->
			<PWAInstallButton />

			<!-- TOGGLE DE TEMA CLARO/OSCURO -->
			<ThemeToggle />

			<!-- BUZÓN DE NOTIFICACIONES (ISSUE-U-BUZON) -->
			{#if user}
				<div class="relative" bind:this={notificationContainerEl}>
					<button 
						type="button" 
						class="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 transition-colors"
						onclick={(e) => { e.stopPropagation(); isNotificationsOpen = !isNotificationsOpen; isProfileOpen = false; }}
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
						<div 
							onclick={(e) => e.stopPropagation()} 
							class="absolute right-0 z-50 mt-2.5 w-80 origin-top-right rounded-lg bg-white dark:bg-gray-900 py-2 shadow-lg ring-1 ring-gray-900/5 dark:ring-gray-800 focus:outline-none border border-gray-100 dark:border-gray-800"
						>
							<div class="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
								<span class="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Notificaciones</span>
								{#if unreadCount > 0}
									<button 
										type="button" 
										onclick={(e) => { e.stopPropagation(); markAllAsRead(); }}
										class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
									>
										Marcar todo como leído
									</button>
								{/if}
							</div>

							<div class="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 scrollbar-hide">
								{#if notificationsLoading}
									<div class="flex justify-center items-center py-6">
										<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
									</div>
								{:else if notifications.length === 0}
									<div class="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
										No tienes notificaciones
									</div>
								{:else}
									<!-- SECCIÓN 1: NUEVAS (ALERTAS SIN LEER) -->
									{#if unreadAlerts.length > 0}
										<div class="px-4 py-1.5 bg-blue-50/20 dark:bg-blue-950/20 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
											Nuevas
										</div>
										{#each unreadAlerts as item (item._id || item.id)}
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); handleNotificationClick(item); }}
												class="w-full text-left px-4 py-3 text-xs flex gap-x-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 bg-blue-50/40 dark:bg-blue-900/10"
											>
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
													<p class="text-gray-900 dark:text-white font-bold">
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

									<!-- SECCIÓN 2: HISTORIAL (NOTIFICACIONES LEÍDAS) -->
									{#if readAlerts.length > 0}
										<div class="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
											Anteriores (Historial)
										</div>
										{#each readAlerts as item (item._id || item.id)}
											<button
												type="button"
												onclick={(e) => { e.stopPropagation(); handleNotificationClick(item); }}
												class="w-full text-left px-4 py-3 text-xs flex gap-x-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
											>
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
													<p class="text-gray-900 dark:text-white font-medium">
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
								{/if}
							</div>
						</div>
					{/if}
				</div>
				
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
							{user?.nombre_funcional || user?.username || 'Usuario'}
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
