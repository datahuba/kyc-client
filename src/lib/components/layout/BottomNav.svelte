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

	// Get max 4 items for bottom bar
	let bottomNavItems = $derived(filteredNavigation.slice(0, 4));
	let moreNavItems = $derived(filteredNavigation.slice(4));
	
	let isMoreMenuOpen = $state(false);

	function isCurrent(href: string) {
		if (href.startsWith('http')) return false;
		return $page.url.pathname === href || ($page.url.pathname.startsWith(href) && href !== '/app/dashboard');
	}

	function logout() {
		userStore.logout();
		goto('/auth/sign-in');
	}
</script>

<!-- Bottom Nav Bar for Mobile -->
<div 
	class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md dark:bg-gray-900/95 border-t border-gray-200/80 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] select-none"
	style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));"
>
	<nav class="flex justify-around items-center h-14 px-2">
		{#each bottomNavItems as item}
			<a 
				href={item.href} 
				class="relative flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-[0.95] transition-transform duration-150"
			>
				<svelte:component 
					this={item.icon} 
					class={`size-6 ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} 
				/>
				<span class={`text-[10px] font-medium leading-none ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
					{item.name}
				</span>
			</a>
		{/each}

		<!-- "Más" Button -->
		<button 
			type="button" 
			onclick={() => isMoreMenuOpen = !isMoreMenuOpen} 
			class="relative flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-[0.95] transition-transform duration-150"
		>
			<Menu2Icon class={`size-6 ${isMoreMenuOpen ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
			<span class={`text-[10px] font-medium leading-none ${isMoreMenuOpen ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
				Más
			</span>
		</button>
	</nav>
</div>

<!-- "Más" Full Screen Modal -->
{#if isMoreMenuOpen}
	<div 
		class="lg:hidden fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm transition-opacity"
		onclick={() => isMoreMenuOpen = false}
		aria-hidden="true"
	></div>
	<div 
		class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[85vh]"
		style="padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));"
		in:slide={{ duration: 300, axis: 'y' }}
		out:slide={{ duration: 250, axis: 'y' }}
	>
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
			<h2 class="text-lg font-bold text-gray-800 dark:text-gray-200">Menú Principal</h2>
			<button onclick={() => isMoreMenuOpen = false} class="p-2 -mr-2 text-gray-500 active:scale-95 transition-transform bg-gray-200/50 dark:bg-gray-700/50 rounded-full">
				<XIcon class="size-5" />
			</button>
		</div>
		
		<div class="overflow-y-auto flex-1 p-2 scrollbar-hide">
			<div class="grid grid-cols-4 gap-4 p-4">
				{#each moreNavItems as item}
					<a 
						href={item.href}
						onclick={() => isMoreMenuOpen = false}
						class="flex flex-col items-center gap-2 p-2 rounded-xl active:bg-gray-100 dark:active:bg-gray-800 active:scale-95 transition-all text-center"
					>
						<div class={`p-3 rounded-2xl ${isCurrent(item.href) ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
							<svelte:component this={item.icon} class="size-6" />
						</div>
						<span class={`text-[10px] font-medium leading-tight ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
							{item.name}
						</span>
					</a>
				{/each}
				
				<button 
					onclick={logout}
					class="flex flex-col items-center gap-2 p-2 rounded-xl active:bg-red-50 dark:active:bg-red-900/20 active:scale-95 transition-all text-center"
				>
					<div class="p-3 rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
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
