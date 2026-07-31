<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { activeClassroomStore } from '$lib/stores/activeClassroomStore';
	import { UsersIcon, ClipboardIcon, TagIcon, XIcon, KeyIcon, QrCodeIcon, FileTextIcon, AcademicCapIcon, Menu2Icon, ChartBarIcon, DocumentAddIcon, IdentificationIcon, CollectionIcon, LoaderIcon, BellIcon } from '$lib/icons/outline'; // F-SIDEBAR-GROUPS nuevos iconos
	import { slide, fade } from 'svelte/transition';
	import { BookIcon, CreditCardIcon, HomeIcon, LogoutIcon, ExclamationCircleIcon, CalendarIcon } from '$lib/icons/solid';  // F-044 (2026-07-22) | F-080 CalendarIcon
	import { goto } from '$app/navigation';
	import CourseCatalogModal from './CourseCatalogModal.svelte';
	import BenefitsModal from './BenefitsModal.svelte';
	import DocumentValidationTable from '$lib/components/ui/DocumentValidationTable.svelte';

	let isCatalogOpen = $state(false);
	let isBenefitsOpen = $state(false);
	let isDocValidationOpen = $state(false);

	const classroomSections = [
		{ id: 'muro',           label: 'Muro' },
		{ id: 'materiales',     label: 'Materiales' },
		{ id: 'tareas',         label: 'Tareas' },
		{ id: 'examenes',       label: 'Exámenes' },
		{ id: 'calificaciones', label: 'Calificaciones' },
		{ id: 'estudiantes',    label: 'Estudiantes' },
	];

	interface NavigationItem {
		type: 'item';
		name: string;
		href: string;
		icon: any;
		roles: string[];
		loginTypes: ('admin' | 'academic')[];
		external?: boolean;
		target?: string;
		rel?: string;
	}

	interface NavigationGroup {
		type: 'group';
		name: string;
		icon: any;
		roles: string[];
		loginTypes: ('admin' | 'academic')[];
		children: NavigationItem[];
	}

	// F-XXX (2026-07-29): spacer visual entre Dashboard y el resto del menú.
	// Se ignora en el filtrado (entryAllowed retorna true siempre).
	interface NavigationSpacer {
		type: 'spacer';
	}

	type NavigationEntry = NavigationItem | NavigationGroup | NavigationSpacer;

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();
	let isCollapsed = $state(false);

	// F-SIDEBAR-ORDER (2026-07-30): Dashboard primero SOLO, luego el resto
	// en orden ALFABÉTICO. Los grupos se intercalan alfabéticamente también.
	// Aplicamos el orden en runtime en lugar de hardcodearlo en el array,
	// para que sea fácil agregar/quitar items sin romper el orden.
	const navItems: NavigationEntry[] = [
		// === Académico (estudiantes y docentes) ===
		{ type: 'item', name: 'Mi Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
		{ type: 'item', name: 'Aula Virtual UAGRM', href: 'https://virtual.uagrm.edu.bo/postgrado/login/index.php', icon: AcademicCapIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },
		{ type: 'item', name: 'Certificados', href: '/app/certificates', icon: FileTextIcon, roles: ['student', 'admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador', 'docente'], loginTypes: ['academic', 'admin'] },
		{ type: 'item', name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
		{ type: 'item', name: 'Mis Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['student'], loginTypes: ['academic'] },
		{ type: 'item', name: 'Mis Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['student'], loginTypes: ['academic'] },
		{ type: 'item', name: 'Mis Solicitudes', href: '/app/requests', icon: DocumentAddIcon, roles: ['student'], loginTypes: ['academic'] },
		{ type: 'item', name: 'Perfil de Notas UAGRM', href: 'https://perfil.uagrm.edu.bo/estudiantes/default.php', icon: ClipboardIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },

		// === Staff administrativo ===
		{ type: 'item', name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['admin', 'superadmin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },

		// F-SIDEBAR-GROUPS (2026-07-31): reorganizar el menu en grupos
		// logicos. Antes todos los items estaban sueltos (ordenados
		// alfabeticamente), pero a Kevin le cuesta encontrarlos.
		// Nueva distribucion:
		//   Academico      -> gestion academica (docentes, programas, calendario, notas)
		//   Financiero     -> modulo economico (CxC, deudores, pagos, informes)
		//   Inscripciones  -> todo lo relacionado a matricular estudiantes
		//   Administrativo  -> gestion administrativa (estudiantes, usuarios, config)
		//   Solicitudes    -> colas de revision (cuenta, certificados, pasivo, tramite)

		// === Academico (desplegable, posicion alfabetica) ===
		{
			type: 'group',
			name: 'Académico',
			icon: AcademicCapIcon,
			roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador', 'docente'],
			loginTypes: ['admin'],
			children: [
				{ type: 'item', name: 'Calendario', href: '/app/courses/calendario', icon: CalendarIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador', 'docente'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Programas', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Validación de Notas', href: '/app/admin/grade-validation', icon: AcademicCapIcon, roles: ['cpd', 'admin', 'superadmin'], loginTypes: ['admin'] },
			]
		},

		// === Financiero (desplegable) ===
		{
			type: 'group',
			name: 'Financiero',
			icon: CreditCardIcon,
			roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'coordinador'],
			loginTypes: ['admin'],
			children: [
				{ type: 'item', name: 'Cuentas por Cobrar', href: '/app/reports/cuentas-por-cobrar', icon: ChartBarIcon, roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'coordinador', 'encargado_curso'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Deudores', href: '/app/payments/deudores', icon: ExclamationCircleIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'cpd', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Gestión de Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Informes', href: '/app/informes', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Reportes de Caja', href: '/app/reports', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'coordinador'], loginTypes: ['admin'] },
			]
		},

		// === Inscripciones (desplegable) - F-SIDEBAR-GROUPS ===
		// Kevin: "inscripciones puede ser un agrupado, luego dentro de ese
		// grupo tener lista de inscritos, luego tener inscripcion individual,
		// inscripcion en lote, luego tener otra que diga no se que puede ser
		// pero que sea relacionado"
		{
			type: 'group',
			name: 'Inscripciones',
			icon: ClipboardIcon,
			roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'],
			loginTypes: ['admin'],
			children: [
				{ type: 'item', name: 'Lista de Inscritos', href: '/app/enrollments', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Inscripción Individual', href: '/app/enrollments?new=1', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				// F-INSCRIPCION-LOTE (2026-07-31): wizard para matricular
				// varios estudiantes a un mismo programa en una sola operacion.
				{ type: 'item', name: 'Inscripción en Lote', href: '/app/enrollments/bulk', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'coordinador', 'encargado_curso'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Pre-inscripciones', href: '/app/pre-registros', icon: ClipboardIcon, roles: ['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Solicitudes de Inscripción', href: '/app/enrollment-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
			]
		},

		// === Administrativo (desplegable) - F-SIDEBAR-GROUPS ===
		{
			type: 'group',
			name: 'Administrativo',
			icon: UsersIcon,
			roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'coordinador'],
			loginTypes: ['admin'],
			children: [
				{ type: 'item', name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Extracto Bancario', href: '/app/bank-statements', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Visor de Errores', href: '/app/admin/errors', icon: ExclamationCircleIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
			]
		},

		// === Solicitudes (desplegable) - cola de revision ===
		{
			type: 'group',
			name: 'Solicitudes',
			icon: ClipboardIcon,
			roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'],
			loginTypes: ['admin'],
			children: [
				{ type: 'item', name: 'Solicitudes de Cuenta', href: '/app/account-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
				// F-CERT-APROBACION (2026-07-30): cola del encargado para aprobar
				// solicitudes de certificados. Filtra por cursos_asignados.
				{ type: 'item', name: 'Solicitudes de Certificados', href: '/app/certificates/requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Solicitudes de Pasivo', href: '/app/passive-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
				{ type: 'item', name: 'Solicitudes de Trámite', href: '/app/requests', icon: DocumentAddIcon, roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
			]
		},
	];

	// F-SIDEBAR-ORDER: separar Dashboard del resto + ordenar alfabéticamente
	// cada bloque. Mantenemos el Dashboard como primer item siempre, luego
	// un spacer, luego el resto en orden alfabético.
	const navigation = $derived.by(() => {
		// 1. Identificar el item Dashboard (el primero que coincida)
		const isStudent = isStudentUser;
		const dashboardName = isStudent ? 'Mi Dashboard' : 'Dashboard';
		const dashboardItem = navItems.find(
			(e) => e.type === 'item' && e.name === dashboardName
		);
		const restItems = navItems
			.filter((e) => e !== dashboardItem)
			.sort((a, b) => {
				const nameA = (a.type === 'item' || a.type === 'group') ? a.name : '';
				const nameB = (b.type === 'item' || b.type === 'group') ? b.name : '';
				return nameA.localeCompare(nameB, 'es');
			});
		const result: NavigationEntry[] = [];
		if (dashboardItem) result.push(dashboardItem);
		result.push({ type: 'spacer' });
		result.push(...restItems);
		return result;
	});

	let userRole = $derived($userStore?.role || 'student');
	let loginType = $derived($userStore?.loginType);
	let academicRole = $derived($userStore?.academicRole);

	let isStudentUser = $derived(userRole === 'student' || academicRole === 'student');
	let canValidateDocs = $derived(['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'].includes(userRole));

	// ISSUE-R-PERFIL-GENERICO: solo el coordinador FINANCIERO ve las vistas económicas.
	let esCoordinadorFinanciero = $derived($userStore.user?.subtipo_coordinador === 'financiero');
	const ECONOMIC_HREFS = ['/app/reports', '/app/payments', '/app/payment-config', '/app/bank-statements', '/app/informes'];

	function entryAllowed(entry: NavigationEntry): boolean {
		// F-XXX (2026-07-29): los spacers se aceptan siempre (no son items).
		if (entry.type === 'spacer') return true;

		// ISSUE-R-ROLES: encargado_curso y coordinador son staff administrativo también
		const isStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole);
		const isTeacher = userRole === 'docente' || academicRole === 'teacher';
		const isStudent = userRole === 'student' || academicRole === 'student';

		if (isStaff) {
			if (!(entry.loginTypes.includes('admin') && entry.roles.includes(userRole))) return false;
			// Coordinador: solo el financiero ve vistas económicas (dentro de items; los grupos los filtra el children-only)
			if (entry.type === 'item' && userRole === 'coordinador' && ECONOMIC_HREFS.includes(entry.href) && !esCoordinadorFinanciero) return false;
			return true;
		}
		if (loginType === 'academic' || isTeacher || isStudent) {
			if (entry.name === 'Aula Virtual UAGRM' || entry.name === 'Perfil de Notas UAGRM') {
				return isTeacher ? entry.roles.includes('docente') : entry.roles.includes('student');
			}
			return isTeacher ? entry.roles.includes('docente') : entry.roles.includes('student');
		}
		return false;
	}

	let filteredNavigation = $derived(navigation
		.map((entry): NavigationEntry | null => {
			// F-XXX (2026-07-29): spacer siempre pasa, no se filtra.
			if (entry.type === 'spacer') return entry;
			// Si es un grupo, filtrar sus hijos. Si no queda ninguno, descartar el grupo.
			if (entry.type === 'group') {
				const visibleChildren = entry.children.filter(c => entryAllowed(c));
				if (visibleChildren.length === 0) return null;
				// ISSUE-R-PERFIL-GENERICO: si el coordinador no es financiero, no mostrar el grupo Financiero
				if (entry.name === 'Financiero' && userRole === 'coordinador' && !esCoordinadorFinanciero) return null;
				return { ...entry, children: visibleChildren };
			}
			return entryAllowed(entry) ? entry : null;
		})
		.filter((e): e is NavigationEntry => e !== null)
	);

	// F-074 / F-075 (2026-07-29): auto-expand del grupo Financiero si la ruta
	// actual está dentro de sus hijos. Da feedback visual sin obligar al user
	// a hacer click extra.
	let expandedGroups = $state<Record<string, boolean>>({});
	$effect(() => {
		const path = $page.url.pathname;
		for (const entry of filteredNavigation) {
			if (entry.type === 'group') {
				const isChildActive = entry.children.some(c => path.startsWith(c.href) && c.href !== '/app/dashboard');
				expandedGroups[entry.name] = isChildActive;
			}
		}
	});

	// F-XXX (2026-07-29): auto-expand del grupo "Solicitudes" si la ruta
	// actual está dentro de sus hijos. (Patrón equivalente al de Financiero.)
	// El effect de arriba ya cubre esto (es genérico por nombre de grupo).

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
	<button class="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-sm md:hidden" onclick={onClose} onkeydown={(e) => { if (e.key === 'Enter') onClose(); }} aria-label="Close sidebar" type="button" transition:slide={{ duration: 200, axis: 'y' }}></button>
{/if}

<div class={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'md:w-20' : 'w-72'}`}>
	<div class="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
		{#if !isCollapsed}
			<div class="flex items-center gap-2.5 min-w-0" in:fade>
				<img src="/images/logo_uagrm_fondo_blanco.jpg" alt="UAGRM" class="h-9 w-9 shrink-0 rounded-md object-contain bg-white p-0.5 ring-1 ring-gray-200 dark:ring-gray-700" />
				<div class="flex flex-col leading-tight min-w-0">
					<span class="text-sm font-extrabold text-primary-700 dark:text-dark-tertiary truncate">Fac. Ciencias Contables</span>
					<span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate">Contaduría Pública</span>
				</div>
			</div>
		{/if}
		<button
			type="button"
			class="hidden md:block -m-2.5 p-2.5 text-gray-500 hover:text-primary-700 transition-colors"
			onclick={() => isCollapsed = !isCollapsed}
			aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
		>
			<Menu2Icon class="size-6" />
		</button>
		<button
			type="button"
			class="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 md:hidden"
			onclick={onClose}
			aria-label="Cerrar menú lateral"
		>
			<XIcon class="size-6" />
		</button>
	</div>
	<div class="flex flex-col gap-y-5 overflow-y-auto px-4 pb-4 pt-8 h-[calc(100vh-4rem)] scrollbar-hide">
		<nav class="flex flex-1 flex-col">
			<ul role="list" class="flex flex-1 flex-col gap-y-7">
				<li>
					<ul role="list" class="-mx-2 space-y-1">
						{#each filteredNavigation as entry, idx (idx + '-' + ((entry as any).name ?? 'spacer-' + idx))}
							{#if entry.type === 'spacer'}
								<!-- F-XXX (2026-07-29): separador visual entre Dashboard y el resto -->
								<li class="my-2 border-t border-gray-200 dark:border-gray-800" aria-hidden="true"></li>
							{:else if entry.type === 'item'}
								<li>
									<a href={entry.href} target={entry.external ? (entry.target ?? '_blank') : undefined} rel={entry.external ? (entry.rel ?? 'noopener noreferrer') : undefined} title={isCollapsed ? entry.name : ''} class={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'} ${isCurrent(entry.href) ? 'bg-gray-50 dark:bg-gray-800 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50'}`}>
										<!-- RENDIMIENTO DE ÍCONOS DINÁMICOS COMPATIBLE CON COMPILADOR ESTRICTO EN LINUX -->
										{#snippet icon()}
											<svelte:component
												this={entry.icon}
												class={`size-6 shrink-0 ${isCurrent(entry.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 group-hover:text-primary-600'}`}
											/>
										{/snippet}
										{@render icon()}
										{#if !isCollapsed}<span in:fade={{ duration: 100 }}>{entry.name}</span>{/if}
									</a>
								</li>
							{:else if entry.type === 'group' && !isCollapsed}
								<!-- F-074 / F-075 (2026-07-29): grupo "Financiero" — desplegable
								     que agrupa Gestión de Pagos / Reportes de Caja / Informes. -->
								<li>
									<button
										type="button"
										onclick={() => expandedGroups[entry.name] = !expandedGroups[entry.name]}
										aria-expanded={!!expandedGroups[entry.name]}
										class="group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-all px-2"
									>
										<svelte:component this={entry.icon} class="size-6 shrink-0 text-gray-400 group-hover:text-primary-600" />
										<span class="flex-1 text-left">{entry.name}</span>
										<svg
											class={`size-4 shrink-0 text-gray-400 transition-transform ${expandedGroups[entry.name] ? 'rotate-180' : ''}`}
											fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									{#if expandedGroups[entry.name]}
										<ul role="list" class="mt-0.5 space-y-0.5 pl-4" transition:slide={{ duration: 150 }}>
											{#each entry.children as child (child.href)}
												<li>
													<a
														href={child.href}
														title={child.name}
														class={`group flex gap-x-3 rounded-md py-1.5 pl-3 pr-2 text-sm leading-6 font-medium transition-all ${
															isCurrent(child.href)
																? 'bg-gray-50 dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-l-2 border-primary-500 -ml-[2px] pl-[14px]'
																: 'text-gray-600 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800'
														}`}
													>
														<span class="size-1.5 mt-2 rounded-full shrink-0 bg-gray-300 group-hover:bg-primary-400"></span>
														<span>{child.name}</span>
													</a>
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{:else if entry.type === 'group' && isCollapsed}
								<!-- Modo colapsado: el grupo se ve como un solo item (el primero de sus hijos) -->
								<li>
									<a href={entry.children[0]?.href ?? '#'} title={entry.name} class={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all justify-center px-0 ${entry.children.some(c => isCurrent(c.href)) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-400 hover:text-primary-600'}`}>
										<svelte:component this={entry.icon} class="size-6 shrink-0" />
									</a>
								</li>
							{/if}
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

				{#if canValidateDocs}
					<li class={isStudentUser ? '' : 'mt-auto border-t border-gray-200 dark:border-gray-800 pt-2'}>
						<button
							type="button"
							onclick={() => isDocValidationOpen = true}
							title={isCollapsed ? 'Validación de Docs' : ''}
							class={`group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-all ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}
						>
							<ClipboardIcon class="size-6 shrink-0 text-amber-600 dark:text-amber-400 group-hover:text-primary-600" />
							{#if !isCollapsed}<span in:fade={{ duration: 100 }}>Validación de Docs</span>{/if}
						</button>
					</li>
				{/if}

				<li class={isStudentUser || canValidateDocs ? '' : 'mt-auto'}>
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

{#if canValidateDocs}
	<DocumentValidationTable isOpen={isDocValidationOpen} onClose={() => isDocValidationOpen = false} />
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
