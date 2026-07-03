<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores'; // Store nativo para rastrear la URL
	import { alert } from '$lib/utils'; // Utilidad de alertas visuales de tu UI

	let { children } = $props();
	let sidebarOpen = $state(false);

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
  cualquier enlace o pestaña de navegación de Postgrado, simulando transiciones de 0ms.
-->
<div class="flex h-screen bg-light-primary dark:bg-dark-background transition-colors" data-sveltekit-preload-data="hover">
	<Sidebar 
		isOpen={sidebarOpen} 
		onClose={() => sidebarOpen = false} 
	/>
	<div class="flex flex-1 flex-col overflow-hidden transition-all duration-300">
		<Header onOpenSidebar={() => sidebarOpen = true} />

		<main class="flex-1 overflow-y-auto p-6">
			{@render children?.()}
		</main>
	</div>
</div>
