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

	// F-LOADING-AUTH (2026-07-30): mientras el userStore se inicializa
	// (lee localStorage para restaurar sesión), mostramos un loading
	// spinner en lugar del shell vacío. Sin esto, el SSR renderiza
	// el shell y el usuario ve una pantalla blanca durante ~500ms
	// antes de que el JS redirija a /auth/sign-in.
	let authChecking = $state(true);

	// ISSUE-Q-PRE: bloquea la navegación del usuario hasta que acepte
	// el reglamento de Posgrado. Aplica a TODO usuario autenticado
	// (estudiantes + personal admin/docente). El modal se muestra la
	// primera vez que se loguea cada uno, y se persiste la aceptación.
	const showTermsModal = $derived(
		$userStore.isAuthenticated &&
			$userStore.user?.terminos_aceptados === false
	);

	onMount(() => {
		// Basic auth check or restore
		userStore.init();
		// Pequeño delay para que el spinner sea visible (y no parpadee)
		setTimeout(() => {
			authChecking = false;
			if (!$userStore.isAuthenticated) {
				goto('/auth/sign-in');
			}
		}, 100);
	});

	// --- GUARDIÁN DE SEGURIDAD REACTIVO (Issue #7 - Control de Crossover) ---
	$effect(() => {
		const path = $page.url.pathname;
		const role = String($userStore.user?.role || '');
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
					'/app/classroom',
					// F-CERTIFICADOS (2026-07-29): Kevin pidió que Certificados esté
					// disponible para TODOS los roles (estudiantes y staff). El
					// estudiante emite el suyo, el staff lo ve para auditoría.
					'/app/certificates',
					// F-TRAMITES-SOLICITUD (2026-07-29): solicitudes de
					// Convalidación, Tutoría, Readmisión y Titulación. El
					// estudiante crea sus propias solicitudes.
					'/app/requests'
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
					'/app/classroom',
					// F-CERTIFICADOS (2026-07-29): visible para todos los roles
					// incluyendo docentes (auditoría de certificados).
					'/app/certificates'
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

<!-- F-LOADING-AUTH (2026-07-30): mientras se verifica la sesiÃ³n, mostrar un
     spinner en lugar del shell vacÃ­o. Visible por ~100ms antes del redirect
     a /auth/sign-in. Mejora la UX percibida del primer paint. -->
{#if authChecking}
	<div class="flex flex-col items-center justify-center h-dvh bg-light-primary dark:bg-dark-background gap-3">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
		<p class="text-sm text-slate-500 dark:text-slate-400">Verificando sesiÃ³nâ€¦</p>
	</div>
{:else}
<div class="flex h-dvh bg-light-primary dark:bg-dark-background transition-colors overflow-x-hidden w-full max-w-full" data-sveltekit-preload-data="hover">
	<Sidebar 
		isOpen={sidebarOpen} 
		onClose={() => sidebarOpen = false} 
	/>
	<div class="relative flex flex-1 flex-col overflow-hidden min-w-0 w-full max-w-full transition-all duration-300">
		<Watermark />
		<Header onOpenSidebar={() => sidebarOpen = true} />

		{#if $userStore.isAuthenticated && $userStore.user?.user_type === 'student' && $userStore.user?.perfil_completado === false}
			<div class="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 shadow-sm">
				<div class="flex items-start sm:items-center gap-3 text-amber-800 dark:text-amber-200 min-w-0">
					<svg class="size-5 shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span class="text-sm font-medium leading-snug">
						Por favor, complete sus datos personales (celular, domicilio, fecha de nacimiento y carnet) para finalizar su registro.
					</span>
				</div>
				<button 
					class="self-end sm:self-auto text-sm font-bold text-amber-900 dark:text-amber-100 bg-amber-200 dark:bg-amber-800/50 hover:bg-amber-300 dark:hover:bg-amber-700/50 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0"
					onclick={() => goto('/app/profile')}
				>
					Actualizar Datos
				</button>
			</div>
		{/if}

		<!-- F-2026-08-12-DESCUENTO-BECA-FIX-MOBILE-NAV: agregar pb-20 (mobile) y
		     pb-6 (desktop) para que el contenido del main NO quede tapado por
		     el BottomNav fixed (z-40, bottom-0, h-16 aprox) en mobile.
		     En desktop el BottomNav se oculta con md:hidden, pero dejamos
		     pb-6 para dar aire con el sidebar. -->
		<main class="relative flex-1 overflow-y-auto p-3.5 pb-28 sm:p-6 md:pb-6">
			{@render children?.()}
		</main>
		<BottomNav />
	</div>
</div>
{/if}

<TermsAcceptanceModal isOpen={showTermsModal} />
