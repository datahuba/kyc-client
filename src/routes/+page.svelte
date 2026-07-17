<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import PWAInstallButton from '$lib/components/ui/PWAInstallButton.svelte';
	import { BriefcaseIcon, ShieldIcon, BookIcon } from '$lib/icons/solid';
	import { ChevronRightIcon } from '$lib/icons/outline';

	let isAuthenticated = $state(false);
	let loginType: 'admin' | 'academic' | null = $state(null);
	let user: any = $state(null);

	userStore.subscribe((state) => {
		isAuthenticated = state.isAuthenticated;
		loginType = state.loginType;
		user = state.user;
	});

	onMount(() => {
		userStore.init();

		if (isAuthenticated && user) {
			const userRole = user.rol || user.role || '';
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
	function handleSelectRole(type: 'student' | 'teacher' | 'admin') {
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

	const roles = [
		{
			id: 'student' as const,
			label: 'Estudiantes',
			description: 'Aula virtual, notas y pagos.',
			href: '#estudiantes',
			gradient: 'from-uagrm-blue to-uagrm-sky',
			glow: 'shadow-uagrm-blue/20 hover:shadow-uagrm-blue/40',
			ring: 'hover:border-uagrm-blue',
			iconBg: 'bg-uagrm-blue/10 dark:bg-uagrm-blue/20',
			iconColor: 'text-uagrm-blue dark:text-uagrm-sky',
			overlay: 'bg-gradient-to-br from-uagrm-blue to-uagrm-sky',
			overlayText: 'group-hover:text-white',
			overlaySubtext: 'group-hover:text-blue-100',
			overlayIcon: 'group-hover:bg-white/20',
			icon: BookIcon
		},
		{
			id: 'teacher' as const,
			label: 'Docentes',
			description: 'Calificaciones y material.',
			href: '#docentes',
			gradient: 'from-uagrm-green to-emerald-600',
			glow: 'shadow-uagrm-green/20 hover:shadow-uagrm-green/40',
			ring: 'hover:border-uagrm-green',
			iconBg: 'bg-uagrm-green/10 dark:bg-uagrm-green/20',
			iconColor: 'text-uagrm-green dark:text-emerald-400',
			overlay: 'bg-gradient-to-br from-uagrm-green to-emerald-600',
			overlayText: 'group-hover:text-white',
			overlaySubtext: 'group-hover:text-emerald-100',
			overlayIcon: 'group-hover:bg-white/20',
			icon: BriefcaseIcon
		},
		{
			id: 'admin' as const,
			label: 'Administrativos',
			description: 'Gestión UAGRM y cobranzas.',
			href: '#administrativos',
			gradient: 'from-primary-700 to-primary-900',
			glow: 'shadow-primary-700/20 hover:shadow-primary-700/40',
			ring: 'hover:border-primary-600',
			iconBg: 'bg-primary-50 dark:bg-primary-900/30',
			iconColor: 'text-primary-700 dark:text-primary-300',
			overlay: 'bg-gradient-to-br from-primary-700 to-primary-900',
			overlayText: 'group-hover:text-white',
			overlaySubtext: 'group-hover:text-rose-100',
			overlayIcon: 'group-hover:bg-white/20',
			icon: BriefcaseIcon
		}
	];
</script>

{#if !isAuthenticated}
<!--
  Role Selection v2 (2026-07-17) — Rediseño mobile-first con patrones NameThatUI:
  - Card (Patrón 66) con hover/gradient overlay + micro-interaction (translate-y, scale)
  - Sticky/Positioned (Patrón 48): site header con safe-area-top
  - Empty State-style hero con gradient institucional
  - Touch targets mínimo 44x44 (h-14/16)
-->
<div
	class="relative min-h-dvh overflow-hidden bg-gradient-to-br from-primary-50 via-white to-uagrm-blue/5 dark:from-dark-background dark:via-dark-primary dark:to-dark-background"
>
	<!-- Patrón decorativo de fondo (solo sm+) -->
	<div class="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
		<div
			class="absolute -top-40 -right-40 size-[28rem] rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20"
		></div>
		<div
			class="absolute -bottom-40 -left-40 size-[28rem] rounded-full bg-uagrm-sky/20 blur-3xl dark:bg-uagrm-sky/10"
		></div>
		<div
			class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[40rem] rounded-full bg-uagrm-gold/5 blur-3xl"
		></div>
	</div>

	<!-- Theme toggle y PWA install -->
	<div class="absolute top-4 right-4 z-50 flex items-center gap-2">
		<PWAInstallButton />
		<ThemeToggle />
	</div>

	<!-- Contenido principal -->
	<div class="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
		<div class="w-full max-w-5xl">
			<!-- Hero / Encabezado institucional -->
			<header class="mb-10 flex flex-col items-center text-center sm:mb-14">
				<div class="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4">
					<img
						src="/images/logo_uagrm_fondo_blanco.jpg"
						alt="UAGRM"
						class="h-16 w-16 rounded-2xl object-contain bg-white p-1.5 shadow-xl ring-1 ring-primary-100 sm:h-24 sm:w-24 sm:p-2 dark:ring-primary-900/40"
					/>
					<img
						src="/images/logo_contaduria_publica_fondo_blanco.jpg"
						alt="Facultad de Contaduría Pública"
						class="h-16 w-16 rounded-2xl object-contain bg-white p-1.5 shadow-xl ring-1 ring-primary-100 sm:h-24 sm:w-24 sm:p-2 dark:ring-primary-900/40"
					/>
				</div>
				<h1
					class="text-2xl font-extrabold tracking-tight text-primary-700 sm:text-4xl md:text-5xl dark:text-dark-tertiary"
				>
					Unidad de Postgrado
				</h1>
				<p
					class="mt-2 max-w-md text-xs font-semibold text-uagrm-blue/80 sm:mt-3 sm:text-sm md:text-base dark:text-uagrm-sky/80"
				>
					Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y
					Finanzas
				</p>
				<div class="mt-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-primary-700 shadow-sm backdrop-blur-sm sm:text-sm dark:bg-dark-surface/80 dark:text-dark-tertiary">
					<span class="size-2 rounded-full bg-primary-500"></span>
					Selecciona tu perfil de acceso
				</div>
			</header>

			<!-- Bento Grid de 3 puertas (mobile-first) -->
			<nav
				class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
				aria-label="Perfiles de acceso"
			>
				{#each roles as role (role.id)}
					<button
						type="button"
						onclick={() => handleSelectRole(role.id)}
						class="group relative w-full overflow-hidden rounded-2xl border-2 border-gray-200/80 bg-white/95 p-6 text-left shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] sm:p-8 dark:border-dark-border/80 dark:bg-dark-surface/95 {role.ring} {role.glow}"
						aria-label={`Acceder como ${role.label}: ${role.description}`}
					>
						<!-- Gradient overlay (aparece en hover) -->
						<div
							class="pointer-events-none absolute inset-0 translate-y-full bg-gradient-to-br transition-transform duration-500 ease-out group-hover:translate-y-0 {role.overlay}"
							aria-hidden="true"
						></div>

						<!-- Contenido -->
						<div class="relative z-10 flex flex-col items-start gap-4">
							<!-- Icono -->
							<div
								class="flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 {role.iconBg} {role.overlayIcon} sm:h-16 sm:w-16"
							>
								<role.icon
									class="size-7 transition-all duration-300 {role.iconColor} group-hover:text-white group-hover:scale-110 sm:size-8"
								/>
							</div>

							<!-- Textos -->
							<div>
								<h2
									class="text-xl font-extrabold text-gray-900 transition-colors duration-300 sm:text-2xl dark:text-white {role.overlayText}"
								>
									{role.label}
								</h2>
								<p
									class="mt-1.5 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400 sm:text-base {role.overlaySubtext}"
								>
									{role.description}
								</p>
							</div>

							<!-- CTA inline -->
							<div
								class="mt-2 flex items-center gap-1.5 text-sm font-semibold {role.iconColor} transition-colors duration-300 {role.overlayText}"
							>
								<span>Ingresar</span>
								<ChevronRightIcon
									class="size-4 transition-transform duration-300 group-hover:translate-x-1"
								/>
							</div>
						</div>
					</button>
				{/each}
			</nav>

			<!-- Trust signals / Footer -->
			<footer class="mt-12 text-center sm:mt-16">
				<p
					class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 sm:text-xs dark:text-gray-500"
				>
					Sistema de Gestión Académica y Financiera
				</p>
				<p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500 sm:text-sm">
					© {new Date().getFullYear()} Unidad de Postgrado · UAGRM
				</p>
			</footer>
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
