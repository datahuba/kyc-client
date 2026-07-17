<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import PWAInstallButton from '$lib/components/ui/PWAInstallButton.svelte';

	// Subscribe to user store
	let isAuthenticated = false;
	let loginType: 'admin' | 'academic' | null = null;
	let user: any = null;

	userStore.subscribe(state => {
		isAuthenticated = state.isAuthenticated;
		loginType = state.loginType;
		user = state.user;
	});

	onMount(() => {
		userStore.init();
		
		if (isAuthenticated && user) {
			const userRole = user.rol || user.role || '';
			// Redirección inteligente si ya está logueado
			if (userRole === 'cpd') {
				goto('/app/students');
			} else {
				goto('/app/dashboard');
			}
		} else if (!isAuthenticated && loginType) {
			goto('/auth/sign-in');
		}
	});

	// ISSUE M: Enrutador de 3 puertas directas (Sin pasos intermedios)
	// Forzar logout al cambiar de perfil para evitar contaminación de sesiones entre roles
	function handleSelectRole(type: 'student' | 'teacher' | 'admin') {
		// Si hay sesión activa de otro rol, limpiarla primero
		userStore.logout();

		if (type === 'student') {
			userStore.setLoginType('academic');
			userStore.setAcademicRole('student');
		} else if (type === 'teacher') {
			userStore.setLoginType('academic');
			userStore.setAcademicRole('teacher');
		} else if (type === 'admin') {
			userStore.setLoginType('admin');
			userStore.setAcademicRole(null);
		}
		goto('/auth/sign-in');
	}
</script>

{#if !isAuthenticated}
<!-- Role Selection UI - 3 Puertas -->
<div class="relative min-h-dvh flex flex-col items-center justify-center bg-light-primary dark:bg-dark-primary p-4 sm:p-6">
	<div class="absolute top-4 right-4 flex items-center gap-2 sm:gap-4 z-50">
		<PWAInstallButton />
		<ThemeToggle />
	</div>
	<div class="w-full max-w-5xl text-center">
		<!-- Encabezado institucional UAGRM -->
		<div class="mb-8 sm:mb-12 flex flex-col items-center justify-center">
			<div class="mb-4 sm:mb-5 flex items-center gap-3 sm:gap-4">
				<img
					src="/images/logo_uagrm_fondo_blanco.jpg"
					alt="UAGRM"
					class="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl object-contain bg-white p-1.5 sm:p-2 shadow-md ring-1 ring-black/5"
				/>
				<img
					src="/images/logo_contaduria_publica_fondo_blanco.jpg"
					alt="Facultad de Contaduría Pública"
					class="h-16 w-16 sm:h-24 sm:w-24 rounded-2xl object-contain bg-white p-1.5 sm:p-2 shadow-md ring-1 ring-black/5"
				/>
			</div>
			<h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-light-secondary dark:text-dark-tertiary mb-1 text-center leading-tight px-2">
				Unidad de Postgrado
			</h1>
			<p class="text-xs sm:text-sm font-semibold text-light-tertiary dark:text-dark-secondary mb-3 max-w-lg mx-auto text-center leading-normal px-4">
				Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y Finanzas
			</p>
			<p class="text-sm sm:text-base text-light-black/70 dark:text-dark-white/70 px-4">
				Selecciona tu perfil de acceso a la plataforma
			</p>
		</div>

		<!-- Contenedor de Botones (3 Columnas) -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl sm:max-w-4xl mx-auto px-2 sm:px-4">

			<!-- PUERTA 1: ESTUDIANTES -->
			<button
				onclick={() => handleSelectRole('student')}
				class="group relative overflow-hidden w-full py-6 sm:py-8 px-4 sm:px-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 active:scale-[0.98]"
			>
				<div class="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>

				<div class="relative z-10 flex flex-col items-center gap-3 sm:gap-4">
					<div class="p-3 sm:p-4 rounded-full bg-blue-50 dark:bg-blue-900/30 group-hover:bg-white/20 transition-colors duration-300">
						<svg class="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 group-hover:text-white transition-all duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
						</svg>
					</div>
					<span class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
						Estudiantes
					</span>
					<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-100 transition-colors duration-300">
						Aula virtual, notas y pagos.
					</p>
				</div>
			</button>

			<!-- PUERTA 2: DOCENTES -->
			<button
				onclick={() => handleSelectRole('teacher')}
				class="group relative overflow-hidden w-full py-6 sm:py-8 px-4 sm:px-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1 active:scale-[0.98]"
			>
				<div class="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>

				<div class="relative z-10 flex flex-col items-center gap-3 sm:gap-4">
					<div class="p-3 sm:p-4 rounded-full bg-emerald-50 dark:bg-emerald-900/30 group-hover:bg-white/20 transition-colors duration-300">
						<svg class="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-all duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					</div>
					<span class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
						Docentes
					</span>
					<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 group-hover:text-emerald-100 transition-colors duration-300">
						Calificaciones y material.
					</p>
				</div>
			</button>

			<!-- PUERTA 3: ADMINISTRATIVOS -->
			<button
				onclick={() => handleSelectRole('admin')}
				class="group relative overflow-hidden w-full py-6 sm:py-8 px-4 sm:px-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary-700 dark:hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-700/20 hover:-translate-y-1 active:scale-[0.98]"
			>
				<div class="absolute inset-0 bg-gradient-to-br from-primary-700 to-primary-900 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>

				<div class="relative z-10 flex flex-col items-center gap-3 sm:gap-4">
					<div class="p-3 sm:p-4 rounded-full bg-primary-50 dark:bg-primary-900/30 group-hover:bg-white/20 transition-colors duration-300">
						<svg class="w-7 h-7 sm:w-8 sm:h-8 text-primary-700 dark:text-primary-300 group-hover:text-white transition-all duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
							<path stroke-linecap="round" stroke-linejoin="round" d="m9 12 2 2 4-4" />
						</svg>
					</div>
					<span class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
						Administrativos
					</span>
					<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 group-hover:text-slate-200 transition-colors duration-300">
						Gestión UAGRM y cobranzas.
					</p>
				</div>
			</button>

		</div>
	</div>
</div>
{:else}
	<!-- Fallback visual rápido mientras actúa el goto() del onMount -->
	<div class="min-h-dvh flex items-center justify-center bg-light-primary dark:bg-dark-primary">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
	</div>
{/if}

<style>
	button {
		-webkit-tap-highlight-color: transparent;
	}
</style>
