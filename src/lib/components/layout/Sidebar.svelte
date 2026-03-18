<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import {
		UsersIcon,
		ClipboardIcon,
		TagIcon,
		XIcon,
		KeyIcon,
		QrCodeIcon,
		FileTextIcon,
		AcademicCapIcon
	} from '$lib/icons/outline';
	import { slide, fade } from 'svelte/transition';
	import Menu2Icon from '$lib/icons/outline/menu2Icon.svelte';
	import { BookIcon, CreditCardIcon, HomeIcon, LogoutIcon } from '$lib/icons/solid';
	import { goto } from '$app/navigation';

	interface NavigationItem {
		name: string;
		href: string;
		icon: any;
		roles: string[];
		loginTypes: ('admin' | 'academic')[];
	}

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	// Estado para colapsar en Desktop
	let isCollapsed = $state(false);

	const navigation: NavigationItem[] = [
		// Student roles (Academic)
		{ name: 'Mi Dashboard', href: '/app/students/dashboard', icon: HomeIcon, roles: ['student'], loginTypes: ['academic'] },
		// Admin roles
		{ name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Cursos', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Classroom', href: '/app/classroom', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'student', 'docente'], loginTypes: ['admin', 'academic'] },
		{ name: 'Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['student'], loginTypes: ['academic'] },
		{ name: 'Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['student'], loginTypes: ['academic'] },
		{ name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
	];

	// Filter navigation based on user role
	// The userStore has loginType which is 'admin' or 'academic'.
	// For academic, we also have academicRole which is 'teacher' or 'student'
	
	let userRole = $derived($userStore?.role || 'student');
	let loginType = $derived($userStore.loginType);
	let academicRole = $derived($userStore.academicRole);

	let filteredNavigation = $derived(navigation.filter(item => {
		// Check if item supports this login type
		if (!item.loginTypes.includes(loginType)) {
			return false;
		}

		// Additional role filtering based on academicRole
		if (loginType === 'academic') {
			if (academicRole === 'teacher') {
				// Docente: solo ve ítems con rol 'docente'
				return item.roles.includes('docente');
			} else {
				// Estudiante: solo ve ítems con rol 'student'
				return item.roles.includes('student');
			}
		} else if (loginType === 'admin') {
			return item.roles.includes('admin') || item.roles.includes('superadmin');
		}

		return false;
	}));

	function isCurrent(href: string) {
		return $page.url.pathname.startsWith(href);
	}

	function logout() {
		userStore.logout();
		onClose();
		goto('/auth/sign-in');
	}
</script>

<!-- Mobile sidebar backdrop -->
{#if isOpen}
	<button 
		class="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-sm lg:hidden"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
		aria-label="Close sidebar"
		type="button"
		transition:slide={{ duration: 200, axis: 'y' }}
	></button>
{/if}

<!-- Sidebar -->
<div class={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
	transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
	${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    ${isCollapsed ? 'lg:w-20' : 'w-72'}
	`}>
	
	<div class="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
		{#if !isCollapsed}
            <span class="text-xl font-bold text-light-tertiary dark:text-light-tertiary" in:fade>KyC</span>
        {/if}
		<button 
            type="button" 
            class="hidden lg:block -m-2.5 p-2.5 text-gray-500 hover:text-primary-600 transition-colors"
            onclick={() => isCollapsed = !isCollapsed}
        >
            <Menu2Icon class="size-6" />
        </button>
		<button 
            type="button" 
            class="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 lg:hidden"
            onclick={onClose}
        >
            <XIcon class="size-6" />
        </button>
	</div>

	<div class="flex flex-col gap-y-5 overflow-y-auto px-4 pb-4 pt-8 h-[calc(100vh-4rem)] scrollbar-hide">
		<nav class="flex flex-1 flex-col">
			<ul role="list" class="flex flex-1 flex-col gap-y-7">
				<li>
					<ul role="list" class="-mx-2 space-y-1">
						{#each filteredNavigation as item}
							<li>
								<a
									href={item.href}
									title={isCollapsed ? item.name : ''}
									class={`
                                        group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all
                                        ${isCollapsed ? 'justify-center px-0' : 'px-2'}
                                        ${isCurrent(item.href)
                                            ? 'bg-gray-50 dark:bg-gray-800 text-primary-600 dark:text-primary-400'
                                            : 'text-gray-700 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
                                    `}
								>
									{#snippet icon()}
										<item.icon class={`size-6 shrink-0 ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`} />
									{/snippet}
									{@render icon()}
									{#if !isCollapsed}
                                        <span in:fade={{ duration: 100 }}>{item.name}</span>
                                    {/if}
								</a>
							</li>
						{/each}
					</ul>
				</li>
				<li class="mt-auto">
                    <button
                        onclick={logout}
                        title={isCollapsed ? 'Cerrar Sesión' : ''}
                        class={`
                            group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-400 
                            hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400 w-full text-left transition-all
                            ${isCollapsed ? 'justify-center px-0' : 'px-2'}
                        `}
                    >
                        <LogoutIcon class="size-6 shrink-0 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                        {#if !isCollapsed}
                            <span in:fade={{ duration: 100 }}>Cerrar Sesión</span>
                        {/if}
                    </button>
                </li>
			</ul>
		</nav>
	</div>
</div>

	


<style>
    /* Ocultar scrollbar pero permitir scroll */
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
