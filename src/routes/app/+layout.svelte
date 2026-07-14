<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import TermsAcceptanceModal from '$lib/components/layout/TermsAcceptanceModal.svelte';
	import Watermark from '$lib/components/layout/Watermark.svelte';
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores'; // Store nativo para rastrear la URL
	import { alert } from '$lib/utils'; // Utilidad de alertas visuales de tu UI

	let { children } = $props();
	let sidebarOpen = $state(false);

	// ISSUE-Q-PRE: bloquea la navegación del estudiante hasta que acepte
	// el reglamento de Posgrado. Personal admin/docente siempre tiene
	// terminos_aceptados=true desde el backend (no aplica a ellos).
	const showTermsModal = $derived(
		$userStore.isAuthenticated &&
			$userStore.user?.user_type === 'student' &&
			$userStore.user?.terminos_aceptados === false
	);

	onMount(() => {
		// Basic auth check or restore
		if (!$userStore.isAuthenticated) {
			// Try to restore or redirect
			userStore.init();
			if (!$userStore.isAuthenticated) {
				goto('/auth/sign-in');
			}
		}
	});

	// --- GUARDIÁN DE SEGURIDAD REACTIVO (Issue #7 - Control de Crossover) ---
	$effect(() => {
		const path = $page.url.pathname;
		const role = String($userStore.user?.rol || $userStore.user?.role || '');
		const isAuthenticated = $userStore.isAuthenticated;

		if (isAuthenticated) {
			// 1. GUARDA PARA ESTUDIANTES ('student')
			if (role === 'student') {
				const allowedStudentPaths = [
					'/app/dashboard',
					'/app/profile',
					'/app/change-password',
					'/app/enrollments',
					'/app/payments',
					'/app/classroom'
				];
				
				const isAllowed = allowedStudentPaths.some(allowedPath => path.startsWith(allowedPath));
				if (!isAllowed) {
					alert('error', 'Acceso denegado. Esta sección administrativa está restringida para estudiantes.');
					goto('/app/dashboard');
				}
			}
			
			// 2. GUARDA PARA DOCENTES ('docente' / 'teacher')
			else if (role === 'docente' || role === 'teacher') {
				const allowedDocentePaths = [
					'/app/dashboard',
					'/app/profile',
					'/app/change-password',
					'/app/classroom'
				];
				
				const isAllowed = allowedDocentePaths.some(allowedPath => path.startsWith(allowedPath));
				if (!isAllowed) {
					alert('error', 'Acceso denegado. Los docentes no tienen acceso a paneles de facturación o control global.');
					goto('/app/dashboard');
				}
			}
			
			// 3. GUARDA PARA ADMINISTRATIVOS NORMALES ('admin')
			else if (role === 'admin') {
				const superAdminOnlyPaths = [
					'/app/users' // Solo SuperAdmin puede gestionar las cuentas administrativas del sistema
				];
				
				const isSuperAdminOnly = superAdminOnlyPaths.some(restrictedPath => path.startsWith(restrictedPath));
				if (isSuperAdminOnly) {
					alert('error', 'Acceso restringido. Esta sección requiere nivel de credenciales de SuperAdmin.');
					goto('/app/dashboard');
				}
			}
		}
	});
</script>

<!-- 
  Añadida la directiva data-sveltekit-preload-data=\"hover\" a nivel del contenedor principal.
  SvelteKit descargará automáticamente el JavaScript de la página y pre-cargará los datos 
  en segundo plano en el mismo instante en que el usuario pase el puntero del mouse sobre 
  cualquier enlace o pestaña de navegación de Posgrado, simulando transiciones de 0ms.
-->
<div class="flex h-screen bg-light-primary dark:bg-dark-background transition-colors overflow-hidden relative" data-sveltekit-preload-data="hover">
	
	<!-- Ambient Background Blobs (Dynamic effect) -->
	<div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-300/20 dark:bg-primary-900/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
	<div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-300/20 dark:bg-blue-900/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" style="animation-delay: 2s;"></div>

	<Sidebar 
		isOpen={sidebarOpen} 
		onClose={() => sidebarOpen = false} 
	/>
	<div class="relative flex flex-1 flex-col overflow-hidden transition-all duration-300 z-10">
		<Watermark />
		<Header onOpenSidebar={() => sidebarOpen = true} />

		{#if $userStore.isAuthenticated && $userStore.user?.user_type === 'student' && $userStore.user?.perfil_completado === false}
			<div class="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 px-6 py-3 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 text-amber-800 dark:text-amber-200">
					<svg class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span class="text-sm font-medium">
						Por favor, complete sus datos personales (celular, domicilio, fecha de nacimiento y carnet) para finalizar su registro.
					</span>
				</div>
				<button 
					class="text-sm font-bold text-amber-900 dark:text-amber-100 bg-amber-200 dark:bg-amber-800/50 hover:bg-amber-300 dark:hover:bg-amber-700/50 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ml-4"
					onclick={() => goto('/app/profile')}
				>
					Actualizar Datos
				</button>
			</div>
		{/if}

		<main class="relative flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
			{@render children?.()}
		</main>
		<BottomNav />
	</div>
</div>

<TermsAcceptanceModal isOpen={showTermsModal} />
