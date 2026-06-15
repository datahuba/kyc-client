<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { activeClassroomStore } from '$lib/stores/activeClassroomStore';
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

	const classroomSections = [
		{ id: 'muro',           label: 'Muro' },
		{ id: 'materiales',     label: 'Materiales' },
		{ id: 'tareas',         label: 'Tareas' },
		{ id: 'examenes',       label: 'Exámenes' },
		{ id: 'calificaciones', label: 'Calificaciones' },
		{ id: 'estudiantes',    label: 'Estudiantes' },
	];

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

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let isCollapsed = $state(false);

	const navigation: NavigationItem[] = [
		// Student/Teacher roles (Academic)
		{ name: 'Mi Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
		
		// Admin/Staff roles 
		{ name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['admin', 'superadmin', 'mae', 'cobranza'], loginTypes: ['admin'] },
		
		// ---> ACCESO DIRECTO A INSCRIPCIONES <---
		{ name: 'Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
		
		{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza'], loginTypes: ['admin'] },
		{ name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Cursos', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
		{ name: 'Gestión de Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae'], loginTypes: ['admin'] },
		
        // ---- ACCESOS EXTERNOS UAGRM ----
        { name: 'Aula Virtual UAGRM', href: 'https://virtual.uagrm.edu.bo/postgrado/login/index.php', icon: AcademicCapIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },
		{ name: 'Perfil de Notas UAGRM', href: 'https://perfil.uagrm.edu.bo/estudiantes/default.php', icon: ClipboardIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },

		// Vistas del estudiante
        { name: 'Mis Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['student'], loginTypes: ['academic'] },
		{ name: 'Mis Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['student'], loginTypes: ['academic'] },
		
		// Configuración Financiera y Usuarios
		{ name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] }, 
		{ name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		
		{ name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
	];

	let userRole = $derived($userStore?.role || $userStore?.user?.rol || 'student');
	let loginType = $derived($userStore?.loginType);
	let academicRole = $derived($userStore?.academicRole);

	let filteredNavigation = $derived(navigation.filter(item => {
		const isStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza'].includes(userRole);
		const isTeacher = userRole === 'docente' || academicRole === 'teacher';
		const isStudent = userRole === 'student' || academicRole === 'student';

		if (isStaff) {
			return item.loginTypes.includes('admin') && item.roles.includes(userRole);
		}

		if (loginType === 'academic' || isTeacher || isStudent) {
			if (item.name === 'Aula Virtual UAGRM' || item.name === 'Perfil de Notas UAGRM') {
				if (isTeacher) return item.roles.includes('docente');
				return item.roles.includes('student');
			}

			if (isTeacher) {
				return item.roles.includes('docente');
			} else {
				return item.roles.includes('student');
			}
		}

		return false;
	}));

	function isCurrent(href: string) {
		if (href.startsWith('http://') || href.startsWith('https://')) return false;
		return $page.url.pathname === href || ($page.url.pathname.startsWith(href) && href !== '/app/dashboard');
	}

	function logout() {
		userStore.logout();
		onClose();
		goto('/auth/sign-in');
	}
</script>

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
								target={item.external ? (item.target ?? '_blank') : undefined}
								rel={item.external ? (item.rel ?? 'noopener noreferrer') : undefined}
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

				{#if (userRole === 'docente' || academicRole === 'teacher') && $activeClassroomStore.id}
					<li transition:slide={{ duration: 200 }}>
						{#if !isCollapsed}
							<div class="px-2 mb-1" in:fade={{ duration: 100 }}>
								<p class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Clase actual</p>
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mt-0.5" title={$activeClassroomStore.nombre ?? ''}>
									{$activeClassroomStore.nombre}
								</p>
							</div>
						{/if}
						<ul role="list" class="-mx-2 space-y-0.5">
							{#each classroomSections as section}
								{@const href = `/app/classroom/clase/${$activeClassroomStore.id}?tab=${section.id}`}
								{@const isActive = $page.url.pathname.startsWith(`/app/classroom/clase/${$activeClassroomStore.id}`) && ($page.url.searchParams.get('tab') ?? 'muro') === section.id}
								<li>
									<a
										{href}
										title={isCollapsed ? section.label : ''}
										class={`
											group flex gap-x-3 rounded-md py-1.5 text-sm font-medium transition-all
											${isCollapsed ? 'justify-center px-0' : 'px-2 pl-4'}
											${isActive
												? 'text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800'
												: 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
										`}
									>
										<span class={`size-1.5 mt-2 rounded-full shrink-0 ${isActive ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-primary-400'}`}></span>
										{#if !isCollapsed}
											<span in:fade={{ duration: 100 }}>{section.label}</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					</li>
				{/if}
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
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
