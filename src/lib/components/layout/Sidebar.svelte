<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { activeClassroomStore } from '$lib/stores/activeClassroomStore';
	import { UsersIcon, ClipboardIcon, TagIcon, XIcon, KeyIcon, QrCodeIcon, FileTextIcon, AcademicCapIcon, Menu2Icon } from '$lib/icons/outline'; // IMPORTACIÓN UNIFICADA DE MENU2ICON
	import { slide, fade } from 'svelte/transition';
	import { BookIcon, CreditCardIcon, HomeIcon, LogoutIcon } from '$lib/icons/solid';
	import { goto } from '$app/navigation';
	import CourseCatalogModal from './CourseCatalogModal.svelte';
	import BenefitsModal from './BenefitsModal.svelte';

	let isCatalogOpen = $state(false);
	let isBenefitsOpen = $state(false);

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
		{ name: 'Mi Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
		{ name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['admin', 'superadmin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		
		// ACCESO DIRECTO A INSCRIPCIONES
		{ name: 'Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		
		{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza'], loginTypes: ['admin'] },
		{ name: 'Solicitudes', href: '/app/account-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Solicitudes de Pasivo', href: '/app/passive-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Solicitudes de Inscripción', href: '/app/enrollment-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Programas', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
		{ name: 'Gestión de Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae'], loginTypes: ['admin'] },
		{ name: 'Reportes de Caja', href: '/app/reports', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'coordinador'], loginTypes: ['admin'] },
		
		{ name: 'Aula Virtual UAGRM', href: 'https://virtual.uagrm.edu.bo/postgrado/login/index.php', icon: AcademicCapIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },
		{ name: 'Perfil de Notas UAGRM', href: 'https://perfil.uagrm.edu.bo/estudiantes/default.php', icon: ClipboardIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },

		{ name: 'Mis Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['student'], loginTypes: ['academic'] },
		{ name: 'Mis Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['student'], loginTypes: ['academic'] },
		
		{ name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd'], loginTypes: ['admin'] },
		{ name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] }, 
		{ name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ name: 'Extracto Bancario', href: '/app/bank-statements', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
	];

	let userRole = $derived($userStore?.role || $userStore?.user?.rol || 'student');
	let loginType = $derived($userStore?.loginType);
	let academicRole = $derived($userStore?.academicRole);

	let isStudentUser = $derived(userRole === 'student' || academicRole === 'student');

	// ISSUE-R-PERFIL-GENERICO: solo el coordinador FINANCIERO ve las vistas económicas.
	let esCoordinadorFinanciero = $derived($userStore.user?.subtipo_coordinador === 'financiero');
	const ECONOMIC_HREFS = ['/app/reports', '/app/payments', '/app/payment-config', '/app/bank-statements'];

	let filteredNavigation = $derived(navigation.filter(item => {
		// ISSUE-R-ROLES: encargado_curso y coordinador son staff administrativo también
		const isStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole);
		const isTeacher = userRole === 'docente' || academicRole === 'teacher';
		const isStudent = userRole === 'student' || academicRole === 'student';

		if (isStaff) {
			if (!(item.loginTypes.includes('admin') && item.roles.includes(userRole))) return false;
			// Coordinador: solo el financiero ve vistas económicas
			if (userRole === 'coordinador' && ECONOMIC_HREFS.includes(item.href) && !esCoordinadorFinanciero) return false;
			return true;
		}
		if (loginType === 'academic' || isTeacher || isStudent) {
			if (item.name === 'Aula Virtual UAGRM' || item.name === 'Perfil de Notas UAGRM') {
				return isTeacher ? item.roles.includes('docente') : item.roles.includes('student');
			}
			return isTeacher ? item.roles.includes('docente') : item.roles.includes('student');
		}
		return false;
	}));

	function isCurrent(href: string) {
		if (href.startsWith('http')) return false;
		return $page.url.pathname === href || ($page.url.pathname.startsWith(href) && href !== '/app/dashboard');
	}

	function logout() {
		userStore.logout();
		onClose();
		goto('/auth/sign-in');
	}
</script>

{#if isOpen}
	<button class="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-sm lg:hidden" onclick={onClose} onkeydown={(e) => { if (e.key === 'Enter') onClose(); }} aria-label="Close sidebar" type="button" transition:slide={{ duration: 200, axis: 'y' }}></button>
{/if}

<div class={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'lg:w-20' : 'w-72'}`}>
	<div class="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
		{#if !isCollapsed}
			<div class="flex items-center gap-2.5 min-w-0" in:fade>
				<img src="/images/logo_uagrm_fondo_blanco.jpg" alt="UAGRM" class="h-9 w-9 shrink-0 rounded-md object-contain bg-white p-0.5 ring-1 ring-gray-200 dark:ring-gray-700" />
				<div class="flex flex-col leading-tight min-w-0">
					<span class="text-sm font-extrabold text-primary-700 dark:text-dark-tertiary truncate">Posgrado UAGRM</span>
					<span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate">Contaduría Pública</span>
				</div>
			</div>
		{/if}
		<button type="button" class="hidden lg:block -m-2.5 p-2.5 text-gray-500 hover:text-primary-700 transition-colors" onclick={() => isCollapsed = !isCollapsed}><Menu2Icon class="size-6" /></button>
		<button type="button" class="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 lg:hidden" onclick={onClose}><XIcon class="size-6" /></button>
	</div>
	<div class="flex flex-col gap-y-5 overflow-y-auto px-4 pb-4 pt-8 h-[calc(100vh-4rem)] scrollbar-hide">
		<nav class="flex flex-1 flex-col">
			<ul role="list" class="flex flex-1 flex-col gap-y-7">
				<li>
					<ul role="list" class="-mx-2 space-y-1">
						{#each filteredNavigation as item}
							<li>
								<a href={item.href} target={item.external ? (item.target ?? '_blank') : undefined} rel={item.external ? (item.rel ?? 'noopener noreferrer') : undefined} title={isCollapsed ? item.name : ''} class={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'} ${isCurrent(item.href) ? 'bg-gray-50 dark:bg-gray-800 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50'}`}>
									<!-- RENDIMIENTO DE ÍCONOS DINÁMICOS COMPATIBLE CON COMPILADOR ESTRICTO EN LINUX -->
									{#snippet icon()}
										<svelte:component 
											this={item.icon} 
											class={`size-6 shrink-0 ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 group-hover:text-primary-600'}`} 
										/>
									{/snippet}
									{@render icon()}
									{#if !isCollapsed}<span in:fade={{ duration: 100 }}>{item.name}</span>{/if}
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
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mt-0.5" title={$activeClassroomStore.nombre ?? ''}>{$activeClassroomStore.nombre}</p>
							</div>
						{/if}
						<ul role="list" class="-mx-2 space-y-0.5">
							{#each classroomSections as section}
								{@const href = `/app/classroom/clase/${$activeClassroomStore.id}?tab=${section.id}`}
								{@const isActive = $page.url.pathname.startsWith(`/app/classroom/clase/${$activeClassroomStore.id}`) && ($page.url.searchParams.get('tab') ?? 'muro') === section.id}
								<li>
									<a {href} title={isCollapsed ? section.label : ''} class={`group flex gap-x-3 rounded-md py-1.5 text-sm font-medium transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2 pl-4'} ${isActive ? 'text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50'}`}>
										<span class={`size-1.5 mt-2 rounded-full shrink-0 ${isActive ? 'bg-primary-500' : 'bg-gray-300 group-hover:bg-primary-400'}`}></span>
										{#if !isCollapsed}<span in:fade={{ duration: 100 }}>{section.label}</span>{/if}
									</a>
								</li>
							{/each}
						</ul>
					</li>
				{/if}
				<!-- Accesos informativos: Catálogo de Cursos y Beneficios del Posgrado (SOLO ESTUDIANTES) -->
				{#if isStudentUser}
					<li class="mt-auto border-t border-gray-200 dark:border-gray-800 pt-3 space-y-1">
						<button
							type="button"
							onclick={() => isCatalogOpen = true}
							title={isCollapsed ? 'Catálogo de Programas' : ''}
							class={`group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}
						>
							<BookIcon class="size-6 shrink-0 text-gray-400 group-hover:text-primary-600" />
							{#if !isCollapsed}<span in:fade={{ duration: 100 }}>Catálogo de Programas</span>{/if}
						</button>
						<button
							type="button"
							onclick={() => isBenefitsOpen = true}
							title={isCollapsed ? 'Beneficios del Posgrado' : ''}
							class={`group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}
						>
							<svg class="size-6 shrink-0 text-gray-400 group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							{#if !isCollapsed}<span in:fade={{ duration: 100 }}>Beneficios del Posgrado</span>{/if}
						</button>
					</li>
				{/if}

				<li class={isStudentUser ? '' : 'mt-auto'}>
					<button onclick={logout} title={isCollapsed ? 'Cerrar Sesión' : ''} class={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:bg-gray-50 hover:text-red-600 w-full text-left transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}>
						<LogoutIcon class="size-6 shrink-0 text-gray-400 group-hover:text-red-600" />
						{#if !isCollapsed}<span in:fade={{ duration: 100 }}>Cerrar Sesión</span>{/if}
					</button>
				</li>
			</ul>
		</nav>
	</div>
</div>

{#if isStudentUser}
	<CourseCatalogModal isOpen={isCatalogOpen} onClose={() => isCatalogOpen = false} />
	<BenefitsModal isOpen={isBenefitsOpen} onClose={() => isBenefitsOpen = false} />
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
