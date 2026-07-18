<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { slide, fade } from 'svelte/transition';
	import { HomeIcon, BookIcon, CreditCardIcon, LogoutIcon } from '$lib/icons/solid';
	import { UsersIcon, ClipboardIcon, TagIcon, QrCodeIcon, FileTextIcon, AcademicCapIcon, KeyIcon, Menu2Icon, XIcon } from '$lib/icons/outline';
	import { goto } from '$app/navigation';

	interface NavigationItem {
		name: string;
		href: string;
		icon: any;
		roles: string[];
		loginTypes: ('admin' | 'academic')[];
		external?: boolean;
		target?: string;
		rel?: string;
	}

	const navigation: NavigationItem[] = [
		{ name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['student', 'docente', 'admin', 'superadmin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['academic', 'admin'] },
		{ name: 'Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador', 'student'], loginTypes: ['admin', 'academic'] },
		{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ name: 'Programas', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
		{ name: 'Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae', 'student'], loginTypes: ['admin', 'academic'] },
		{ name: 'Caja', href: '/app/reports', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'coordinador'], loginTypes: ['admin'] },
		{ name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] },
		{ name: 'Perfil', href: '/app/profile', icon: UsersIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
	];

	let userRole = $derived($userStore?.role || $userStore?.user?.rol || 'student');
	let loginType = $derived($userStore?.loginType);
	let academicRole = $derived($userStore?.academicRole);
	let esCoordinadorFinanciero = $derived($userStore.user?.subtipo_coordinador === 'financiero');
	const ECONOMIC_HREFS = ['/app/reports', '/app/payments', '/app/payment-config', '/app/bank-statements'];

	let filteredNavigation = $derived(navigation.filter(item => {
		const isStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole);
		const isTeacher = userRole === 'docente' || academicRole === 'teacher';
		const isStudent = userRole === 'student' || academicRole === 'student';

		if (isStaff) {
			if (!(item.loginTypes.includes('admin') && item.roles.includes(userRole))) return false;
			if (userRole === 'coordinador' && ECONOMIC_HREFS.includes(item.href) && !esCoordinadorFinanciero) return false;
			return true;
		}
		if (loginType === 'academic' || isTeacher || isStudent) {
			return isTeacher ? item.roles.includes('docente') : item.roles.includes('student');
		}
		return false;
	}));

	// Primary items: max 4 más el "Más"
	let bottomNavItems = $derived(filteredNavigation.slice(0, 4));
	let moreNavItems = $derived(filteredNavigation.slice(4));

	let isMoreMenuOpen = $state(false);
	// Path actual reactivo (en Svelte 5 los stores como $page NO son auto-reactivos en runes,
	// hay que wrappear en $derived para que se re-evalúe en navegaciones)
	let currentPath = $derived($page.url.pathname);
	// Estado reactivo: el item "Más" está activo si el sheet está abierto o algún item de more está activo
	let moreActive = $derived.by(() => {
		if (isMoreMenuOpen) return true;
		const path = currentPath;
		return moreNavItems.some(i =>
			i.href === path || (path.startsWith(i.href) && i.href !== '/app/dashboard')
		);
	});
	// Haptic feedback (Vibration API) en tap — funciona en Android, no en iOS
	function hapticTap() {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try { navigator.vibrate(8); } catch (_) { /* ignore */ }
		}
	}

	function isCurrent(href: string) {
		if (href.startsWith('http')) return false;
		const path = currentPath;
		return path === href || (path.startsWith(href) && href !== '/app/dashboard');
	}

	// Set reactivo de hrefs activos (necesario porque isCurrent no es reactivo por sí solo)
	let activeBottomHrefs = $derived.by(() => {
		const path = currentPath;
		const set = new Set<string>();
		for (const item of bottomNavItems) {
			if (item.href === path || (path.startsWith(item.href) && item.href !== '/app/dashboard')) {
				set.add(item.href);
			}
		}
		return set;
	});
	let activeMoreHrefs = $derived.by(() => {
		const path = currentPath;
		const set = new Set<string>();
		for (const item of moreNavItems) {
			if (item.href === path || (path.startsWith(item.href) && item.href !== '/app/dashboard')) {
				set.add(item.href);
			}
		}
		return set;
	});

	function logout() {
		hapticTap();
		userStore.logout();
		goto('/auth/sign-in');
	}

	function openMore() {
		hapticTap();
		isMoreMenuOpen = true;
	}

	function closeMore() {
		isMoreMenuOpen = false;
	}

	function handleNavClick() {
		hapticTap();
	}
</script>

<!-- Bottom Nav nativo iOS/Material -->
<div
	class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.3)] select-none"
	style="padding-bottom: max(0.25rem, env(safe-area-inset-bottom, 0px));"
>
	<nav class="flex justify-around items-center h-16 px-1.5">
		<!-- (mantenido por compatibilidad) -->
		{#each bottomNavItems as item, idx (item.href)}
			{@const active = activeBottomHrefs.has(item.href)}
			<a
				href={item.href}
				onclick={handleNavClick}
				class="relative flex flex-col items-center justify-center flex-1 h-full group transition-transform duration-150 active:scale-95"
				aria-current={active ? 'page' : undefined}
			>
				<!-- Pill background animada para el item activo (estilo iOS/Material 3) -->
				{#if active}
					<div
						class="absolute top-1.5 inset-x-3 h-9 rounded-full bg-primary-100/90 dark:bg-primary-900/40 transition-all duration-300 ease-out"
						in:fade={{ duration: 150 }}
					></div>
				{/if}
				<svelte:component
					this={item.icon}
					class={`relative size-6 transition-colors duration-200 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}
				/>
				<span class={`relative text-[10px] font-medium leading-none mt-1 transition-colors duration-200 ${active ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
					{item.name}
				</span>
			</a>
		{/each}

		<!-- "Más" Button -->
		<button
			type="button"
			onclick={openMore}
			class="relative flex flex-col items-center justify-center flex-1 h-full group transition-transform duration-150 active:scale-95"
			aria-label="Más opciones"
			aria-expanded={isMoreMenuOpen}
		>
			{#if moreActive}
				<div
					class="absolute top-1.5 inset-x-3 h-9 rounded-full bg-primary-100/90 dark:bg-primary-900/40 transition-all duration-300 ease-out"
					in:fade={{ duration: 150 }}
				></div>
			{/if}
			<Menu2Icon class={`relative size-6 transition-colors duration-200 ${moreActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
			<span class={`relative text-[10px] font-medium leading-none mt-1 transition-colors duration-200 ${moreActive ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
				Más
			</span>
		</button>
	</nav>
</div>

<!-- "Más" Bottom Sheet nativo -->
{#if isMoreMenuOpen}
	<!-- Backdrop con blur -->
	<button
		type="button"
		class="md:hidden fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity cursor-default"
		onclick={closeMore}
		aria-label="Cerrar menú"
	></button>

	<!-- Bottom Sheet con drag handle -->
	<div
		class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[88vh] border-t border-gray-200/40 dark:border-gray-800/40"
		style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));"
		in:slide={{ duration: 300, axis: 'y' }}
		out:slide={{ duration: 250, axis: 'y' }}
		role="dialog"
		aria-label="Menú principal"
	>
		<!-- Drag handle (solo visual, no interactivo para esta versión) -->
		<div class="flex justify-center pt-2.5 pb-1.5">
			<div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
		</div>

		<!-- Header del sheet -->
		<div class="px-5 pb-3 flex justify-between items-center">
			<div>
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">Menú Principal</h2>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{moreNavItems.length + 1} opciones disponibles</p>
			</div>
			<button
				onclick={closeMore}
				class="p-2 text-gray-500 dark:text-gray-400 active:scale-90 transition-transform bg-gray-100 dark:bg-gray-800 rounded-full"
				aria-label="Cerrar menú"
			>
				<XIcon class="size-5" />
			</button>
		</div>

		<!-- Grid de opciones estilo iOS/Material -->
		<div class="overflow-y-auto flex-1 px-3 pb-4 scrollbar-hide">
			<div class="grid grid-cols-4 gap-1.5">
				{#each moreNavItems as item (item.href)}
					{@const active = activeMoreHrefs.has(item.href)}
					<a
						href={item.href}
						onclick={() => { hapticTap(); closeMore(); }}
						class="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl active:bg-gray-100 dark:active:bg-gray-800 active:scale-95 transition-all text-center"
					>
						<div class={`p-3 rounded-2xl transition-colors ${active ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
							<svelte:component this={item.icon} class="size-6" />
						</div>
						<span class={`text-[10px] font-medium leading-tight ${active ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
							{item.name}
						</span>
					</a>
				{/each}

				<!-- Botón logout -->
				<button
					type="button"
					onclick={logout}
					class="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl active:bg-red-50 dark:active:bg-red-900/20 active:scale-95 transition-all text-center"
				>
					<div class="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
						<LogoutIcon class="size-6" />
					</div>
					<span class="text-[10px] font-medium leading-tight text-red-600 dark:text-red-400">
						Salir
					</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
