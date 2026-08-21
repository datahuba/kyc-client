<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { slide, fade } from 'svelte/transition';
	import { HomeIcon, BookIcon, CreditCardIcon, LogoutIcon } from '$lib/icons/solid';
	import { UsersIcon, ClipboardIcon, TagIcon, QrCodeIcon, FileTextIcon, AcademicCapIcon, KeyIcon, Menu2Icon, XIcon, SearchIcon, ExclamationIcon, BellIcon, MailIcon, ChartBarIcon, DocumentAddIcon } from '$lib/icons/outline';
	import { goto } from '$app/navigation';
	import { getAllNavItems, staffBugReportItem, type NavigationEntry, type NavigationItem, type NavigationGroup } from '$lib/navigation/sidebarItems';

	let userRole = $derived($userStore?.role || 'student');
	let loginType = $derived($userStore?.loginType);
	let academicRole = $derived($userStore?.academicRole);
	let esCoordinadorFinanciero = $derived($userStore.user?.subtipo_coordinador === 'financiero');
	
	const ECONOMIC_HREFS = ['/app/reports', '/app/reports/cuentas-historicas', '/app/payments', '/app/payment-config', '/app/bank-statements', '/app/informes'];
	const FINANCIERO_HIDDEN_GROUPS = ['Académico', 'Inscripciones'];
	const FINANCIERO_HIDDEN_HREFS = ['/app/enrollments', '/app/students', '/app/teachers', '/app/courses', '/app/requests'];

	function entryAllowed(item: NavigationItem | NavigationGroup): boolean {
		const isStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole);
		const isTeacher = userRole === 'docente' || academicRole === 'teacher';
		const isStudent = userRole === 'student' || academicRole === 'student';

		if (isStaff) {
			if (!(item.loginTypes.includes('admin') && item.roles.includes(userRole))) return false;
			if (item.type === 'item' && userRole === 'coordinador' && ECONOMIC_HREFS.includes(item.href) && !esCoordinadorFinanciero) return false;
			if (item.type === 'item' && userRole === 'coordinador' && esCoordinadorFinanciero && FINANCIERO_HIDDEN_HREFS.includes(item.href)) return false;
			return true;
		}
		if (loginType === 'academic' || isTeacher || isStudent) {
			return isTeacher ? item.roles.includes('docente') : item.roles.includes('student');
		}
		return false;
	}

	// Obtener y filtrar toda la navegación del sistema
	const allEntries = getAllNavItems();
	
	let filteredGroups = $derived.by(() => {
		const groups: { name: string; icon: any; items: NavigationItem[] }[] = [];
		const directItems: NavigationItem[] = [];

		for (const entry of allEntries) {
			if (entry.type === 'spacer') continue;
			if (entry.type === 'item') {
				if (entryAllowed(entry) && entry.name !== 'Dashboard' && entry.name !== 'Mi Dashboard') {
					directItems.push(entry);
				}
			} else if (entry.type === 'group') {
				if (entry.name === 'Financiero' && userRole === 'coordinador' && !esCoordinadorFinanciero) continue;
				if (FINANCIERO_HIDDEN_GROUPS.includes(entry.name) && userRole === 'coordinador' && esCoordinadorFinanciero) continue;
				
				const visibleChildren = entry.children.filter(c => entryAllowed(c));
				if (visibleChildren.length > 0) {
					groups.push({
						name: entry.name,
						icon: entry.icon,
						items: visibleChildren
					});
				}
			}
		}

		if (directItems.length > 0) {
			groups.unshift({
				name: 'Accesos Directos',
				icon: HomeIcon,
				items: directItems
			});
		}

		// Agregar reporte de bug si aplica
		if (staffBugReportItem.roles.includes(userRole) && loginType === 'admin') {
			const herramientasGroup = groups.find(g => g.name === 'Herramientas');
			if (herramientasGroup) {
				herramientasGroup.items.push(staffBugReportItem);
			} else {
				groups.push({
					name: 'Herramientas',
					icon: ExclamationIcon,
					items: [staffBugReportItem]
				});
			}
		}

		return groups;
	});

	// Tabs principales del Bottom Bar según rol
	let primaryTabs = $derived.by(() => {
		if (userRole === 'student' || academicRole === 'student') {
			return [
				{ name: 'Inicio', href: '/app/dashboard', icon: HomeIcon },
				{ name: 'Pagos', href: '/app/payments', icon: CreditCardIcon },
				{ name: 'Inscrito', href: '/app/enrollments', icon: FileTextIcon },
				{ name: 'Certificados', href: '/app/certificates', icon: ClipboardIcon }
			];
		}
		if (userRole === 'docente' || academicRole === 'teacher') {
			return [
				{ name: 'Inicio', href: '/app/dashboard', icon: HomeIcon },
				{ name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon },
				{ name: 'Programas', href: '/app/courses', icon: BookIcon },
				{ name: 'Clases', href: '/app/classroom/docente', icon: BookIcon }
			];
		}
		// Staff (Superadmin, Admin, CPD, Cobranza, MAE, Encargado, Coordinador)
		return [
			{ name: 'Inicio', href: '/app/dashboard', icon: HomeIcon },
			{ name: 'Pagos', href: '/app/payments', icon: CreditCardIcon },
			{ name: 'Inscripciones', href: '/app/enrollments', icon: ClipboardIcon },
			{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon }
		];
	});

	let isMoreMenuOpen = $state(false);
	let currentPath = $derived($page.url.pathname);
	let searchQuery = $state('');

	function hapticTap() {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try { navigator.vibrate(10); } catch (_) { /* ignore */ }
		}
	}

	function isTabActive(href: string): boolean {
		if (href === '/app/dashboard') return currentPath === '/app/dashboard';
		return currentPath === href || currentPath.startsWith(href);
	}

	let moreActive = $derived.by(() => {
		if (isMoreMenuOpen) return true;
		const isAnyPrimaryActive = primaryTabs.some(t => isTabActive(t.href));
		return !isAnyPrimaryActive;
	});

	function logout() {
		hapticTap();
		isMoreMenuOpen = false;
		userStore.logout();
		goto('/auth/sign-in');
	}

	function openMore() {
		hapticTap();
		searchQuery = '';
		isMoreMenuOpen = true;
	}

	function closeMore() {
		isMoreMenuOpen = false;
		searchQuery = '';
	}

	// Filtrado reactivo de búsqueda en el menú
	let displayGroups = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return filteredGroups;

		return filteredGroups
			.map(group => ({
				...group,
				items: group.items.filter(item => item.name.toLowerCase().includes(q))
			}))
			.filter(group => group.items.length > 0);
	});
</script>

<!-- Floating Glassmorphic Tab Bar (Mobile App Style) -->
<div class="md:hidden fixed bottom-3 inset-x-3.5 z-40 select-none pointer-events-none" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
	<nav class="pointer-events-auto flex items-center justify-around h-16 px-1 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/5 transition-all">
		{#each primaryTabs as item (item.href)}
			{@const active = isTabActive(item.href)}
			{@const TabIcon = item.icon}
			<a
				href={item.href}
				onclick={() => { hapticTap(); if (isMoreMenuOpen) closeMore(); }}
				class="relative flex flex-col items-center justify-center flex-1 h-full py-1 group transition-all duration-200 active:scale-90"
				aria-current={active ? 'page' : undefined}
			>
				{#if active}
					<div
						class="absolute top-1.5 inset-x-1.5 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-800/80 shadow-sm"
						in:fade={{ duration: 150 }}
					></div>
				{/if}
				<TabIcon
					class={`relative size-5.5 transition-transform duration-200 ${active ? 'text-primary-700 dark:text-primary-400 scale-105' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}
				/>
				<span class={`relative text-[10px] tracking-tight leading-none mt-1 transition-colors duration-200 truncate max-w-[60px] ${active ? 'text-primary-700 dark:text-primary-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
					{item.name}
				</span>
			</a>
		{/each}

		<!-- Botón "Menú Completo / Más" -->
		<button
			type="button"
			onclick={isMoreMenuOpen ? closeMore : openMore}
			class="relative flex flex-col items-center justify-center flex-1 h-full py-1 group transition-all duration-200 active:scale-90"
			aria-label="Ver todas las opciones del sistema"
			aria-expanded={isMoreMenuOpen}
		>
			{#if moreActive}
				<div
					class="absolute top-1.5 inset-x-1.5 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-800/80 shadow-sm"
					in:fade={{ duration: 150 }}
				></div>
			{/if}
			<Menu2Icon class={`relative size-5.5 transition-transform duration-200 ${moreActive ? 'text-primary-700 dark:text-primary-400 scale-105' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
			<span class={`relative text-[10px] tracking-tight leading-none mt-1 transition-colors duration-200 ${moreActive ? 'text-primary-700 dark:text-primary-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
				Menú
			</span>
		</button>
	</nav>
</div>

<!-- "Menú Completo" Bottom Sheet con TODAS las opciones del sistema -->
{#if isMoreMenuOpen}
	<!-- Backdrop con blur profundo -->
	<button
		type="button"
		class="md:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md transition-opacity cursor-default"
		onclick={closeMore}
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 150 }}
		aria-label="Cerrar menú"
	></button>

	<!-- Sheet flotante deslizable desde abajo -->
	<div
		class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 backdrop-blur-2xl rounded-t-[2.25rem] shadow-[0_-16px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_-16px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[88vh] border-t border-slate-200 dark:border-slate-800"
		style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));"
		in:slide={{ duration: 250, axis: 'y' }}
		out:slide={{ duration: 200, axis: 'y' }}
		role="dialog"
		aria-label="Menú completo de navegación"
	>
		<!-- Drag Handle Indicator -->
		<div class="flex justify-center pt-3 pb-1.5" onclick={closeMore}>
			<div class="w-12 h-1.25 rounded-full bg-slate-300 dark:bg-slate-700"></div>
		</div>

		<!-- Header del Sheet con Perfil del Usuario -->
		<div class="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
			<div class="flex items-center gap-3 min-w-0">
				<div class="size-11 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-primary-700/20 shrink-0">
					{($userStore.user?.nombre || $userStore.user?.username || 'U').charAt(0).toUpperCase()}
				</div>
				<div class="min-w-0">
					<h2 class="text-sm font-extrabold text-slate-900 dark:text-white truncate">
						{$userStore.user?.nombre || $userStore.user?.username || 'Usuario'}
					</h2>
					<div class="flex items-center gap-1.5 mt-0.5">
						<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
							{userRole}
						</span>
						<span class="text-[11px] text-slate-400 dark:text-slate-500 truncate">
							{$userStore.user?.email || ''}
						</span>
					</div>
				</div>
			</div>
			<button
				type="button"
				onclick={closeMore}
				class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-90 transition-transform bg-slate-100 dark:bg-slate-800 rounded-full shrink-0"
				aria-label="Cerrar menú"
			>
				<XIcon class="size-5" />
			</button>
		</div>

		<!-- Buscador Rápido de Módulos -->
		<div class="px-5 pt-3 pb-2">
			<div class="relative">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar módulo o sección..."
					class="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-600 outline-none"
				/>
				<div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
					<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
				</div>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => searchQuery = ''}
						class="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
					>
						✕
					</button>
				{/if}
			</div>
		</div>

		<!-- Lista Completa y Categorizada de Navegación -->
		<div class="overflow-y-auto flex-1 px-5 py-2 space-y-4 scrollbar-hide">
			{#if displayGroups.length === 0}
				<div class="text-center py-8 text-slate-400 text-xs">
					No se encontraron opciones para "{searchQuery}"
				</div>
			{:else}
				{#each displayGroups as group (group.name)}
					<div class="space-y-2">
						<div class="flex items-center gap-2 text-slate-400 dark:text-slate-500 px-1">
							<span class="text-[10px] font-black uppercase tracking-wider">{group.name}</span>
							<div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							{#each group.items as item (item.href)}
								{@const active = isTabActive(item.href)}
								{@const ItemIcon = item.icon}
								<a
									href={item.href}
									target={item.external ? (item.target ?? '_blank') : undefined}
									rel={item.external ? (item.rel ?? 'noopener noreferrer') : undefined}
									onclick={() => { hapticTap(); closeMore(); }}
									class={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all active:scale-95 ${active ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 font-bold' : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
								>
									<div class={`p-2 rounded-lg shrink-0 ${active ? 'bg-primary-700 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm'}`}>
										<ItemIcon class="size-4.5" />
									</div>
									<span class="text-xs font-semibold leading-tight line-clamp-2 flex-1">
										{item.name}
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

			<!-- Botón Cerrar Sesión Destacado -->
			<div class="pt-2 border-t border-slate-100 dark:border-slate-800">
				<button
					type="button"
					onclick={logout}
					class="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-xs active:scale-95 transition-all border border-red-100 dark:border-red-900/40 shadow-sm"
				>
					<LogoutIcon class="size-4.5" />
					<span>Cerrar Sesión de {userRole.toUpperCase()}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.scrollbar-hide::-webkit-scrollbar { display: none; }
	.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
