<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import {
		ChevronLeftIcon,
		EyeIcon,
		EyeOffIcon,
		ChevronRightIcon
	} from '$lib/icons/outline';
	import UserIcon from '$lib/icons/outline/userIcon.svelte';
	import { ExclamationCircleIcon, LockIcon } from '$lib/icons/solid';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { LOGIN_TYPE_KEY } from '$lib/constants';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import PWAInstallButton from '$lib/components/ui/PWAInstallButton.svelte';

	let showPassword = $state(false);
	let username = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let loginType: 'admin' | 'academic' | null = $state(null);
	let academicRole: 'teacher' | 'student' | null = $state(null);

	// Field-level error state (Patrón NameThatUI: Form Field)
	let fieldErrors = $state<{ username?: string; password?: string }>({});
	let usernameFocused = $state(false);
	let passwordFocused = $state(false);

	onMount(() => {
		userStore.init();

		const unsubscribe = userStore.subscribe((state) => {
			loginType = state.loginType;
			academicRole = state.academicRole;
		});

		const storedType = localStorage.getItem(LOGIN_TYPE_KEY);
		if (!storedType && !loginType) {
			goto('/');
		}

		return unsubscribe;
	});

	function validateField(field: 'username' | 'password') {
		const errors = { ...fieldErrors };
		if (field === 'username') {
			if (!username.trim()) errors.username = 'Ingresa tu usuario, correo o carnet';
		}
		if (field === 'password') {
			if (!password) errors.password = 'Ingresa tu contraseña';
			else if (password.length < 5) errors.password = 'La contraseña debe tener al menos 5 caracteres';
		}
		fieldErrors = errors;
	}

	async function handleSubmit() {
		errorMessage = '';
		// Validar todos los campos antes de enviar
		const errors: typeof fieldErrors = {};
		if (!username.trim()) errors.username = 'Ingresa tu usuario, correo o carnet';
		if (!password) errors.password = 'Ingresa tu contraseña';
		else if (password.length < 5) errors.password = 'La contraseña debe tener al menos 5 caracteres';
		fieldErrors = errors;
		if (Object.keys(errors).length > 0) return;

		isLoading = true;
		try {
			await userStore.login({ username, password });
			const state = get(userStore);

			if (state.user) {
				const userRole = state.role || state.user?.rol || state.user?.role || '';
				const currentAcademicRole = state.academicRole || '';

				if ((userRole as string) === 'student' || currentAcademicRole === 'student') {
					goto('/app/dashboard');
				} else if (
					(userRole as string) === 'teacher' ||
					userRole === 'docente' ||
					currentAcademicRole === 'teacher'
				) {
					goto('/app/dashboard');
				} else if (userRole === 'cpd') {
					goto('/app/students');
				} else {
					goto('/app/dashboard');
				}
			} else {
				goto('/');
			}
		} catch (error: any) {
			console.error(error);
			errorMessage = error.message || 'Error al iniciar sesión';
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSubmit();
		}
	}

	function getLoginTypeLabel(): string {
		if (loginType === 'academic') {
			return academicRole === 'teacher' ? 'Docente' : 'Estudiante (Académico)';
		}
		return loginType === 'admin' ? 'Administrativo' : 'Usuario';
	}

	function switchRole() {
		userStore.setLoginType(null);
		userStore.setAcademicRole(null);
		goto('/');
	}
</script>

<!--
  Sign-in v2 (2026-07-17) — Rediseño mobile-first aplicando patrones de NameThatUI:
  - Form Field con labels flotantes, error inline y aria-describedby
  - Site Header / sticky positioning con safe-area
  - Card elevado con backdrop-blur y shadow-xl
  - Focus ring con :focus-visible (color de marca)
  - Botones con micro-interaction (loading animado, hover con translate)
  - Hero gradient institucional UAGRM (guindo → blanco)
  - Trust signals visuales (logos integrados, badge institucional)
-->

<!-- Background hero con gradient sutil (mobile-first) -->
<div
	class="relative min-h-dvh overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50/40 dark:from-dark-background dark:via-dark-primary dark:to-dark-background"
>
	<!-- Patrón decorativo sutil (círculos) — solo en sm+ para no distraer en mobile -->
	<div
		class="pointer-events-none absolute inset-0 hidden sm:block"
		aria-hidden="true"
	>
		<div
			class="absolute -top-32 -right-32 size-96 rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20"
		></div>
		<div
			class="absolute -bottom-32 -left-32 size-96 rounded-full bg-uagrm-blue/10 blur-3xl dark:bg-uagrm-sky/10"
		></div>
	</div>

	<!-- Theme toggle y PWA install (esquina superior derecha) -->
	<div class="absolute top-4 right-4 z-50 flex items-center gap-2">
		<PWAInstallButton />
		<ThemeToggle />
	</div>

	<!-- Botón volver (esquina superior izquierda) -->
	<button
		type="button"
		onclick={switchRole}
		class="absolute top-4 left-4 z-50 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-primary-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md active:scale-95 dark:bg-dark-surface/80 dark:text-dark-tertiary dark:hover:bg-dark-surface"
		aria-label="Volver a selección de perfil"
	>
		<ChevronLeftIcon class="size-4" />
		<span>Cambiar perfil</span>
	</button>

	<!-- Contenido principal -->
	<div class="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
		<div class="w-full max-w-md">
			<!-- Logos institucionales (mobile-first) -->
			<div class="mb-8 flex flex-col items-center sm:mb-10">
				<div class="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-4">
					<img
						src="/images/logo_uagrm_fondo_blanco.jpg"
						alt="UAGRM"
						class="h-14 w-14 rounded-2xl object-contain bg-white p-1.5 shadow-lg ring-1 ring-primary-100 sm:h-16 sm:w-16 dark:ring-primary-900/40"
					/>
					<img
						src="/images/logo_contaduria_publica_fondo_blanco.jpg"
						alt="Facultad de Contaduría Pública"
						class="h-14 w-14 rounded-2xl object-contain bg-white p-1.5 shadow-lg ring-1 ring-primary-100 sm:h-16 sm:w-16 dark:ring-primary-900/40"
					/>
				</div>
				<h1
					class="text-2xl font-extrabold tracking-tight text-primary-700 text-center dark:text-dark-tertiary sm:text-3xl"
				>
					Unidad de Postgrado
				</h1>
				<p
					class="mt-1.5 max-w-sm text-center text-xs font-medium text-uagrm-blue/80 dark:text-uagrm-sky/80 sm:text-sm"
				>
					Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y
					Finanzas
				</p>
				{#if loginType}
					<span
						class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-dark-tertiary"
					>
						<span class="size-1.5 rounded-full bg-primary-500"></span>
						{getLoginTypeLabel()}
					</span>
				{/if}
			</div>

			<!-- Card de login (elevated + backdrop blur) -->
			<div
				class="rounded-3xl border border-gray-200/60 bg-white/95 p-6 shadow-xl shadow-primary-900/5 backdrop-blur-md sm:p-8 dark:border-dark-border/60 dark:bg-dark-surface/95 dark:shadow-black/20"
			>
				<header class="mb-6">
					<h2 class="text-xl font-bold text-light-black dark:text-dark-white sm:text-2xl">
						Iniciar Sesión
					</h2>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Ingresa tus credenciales para continuar
					</p>
				</header>

				<!-- Error general (server) -->
				{#if errorMessage}
					<div
						role="alert"
						class="mb-5 flex items-start gap-3 rounded-xl border border-light-error/30 bg-red-50/80 p-3.5 dark:border-dark-error/30 dark:bg-red-950/30"
					>
						<ExclamationCircleIcon
							class="mt-0.5 size-5 shrink-0 text-light-error dark:text-dark-error"
						/>
						<p class="text-sm font-medium text-light-error dark:text-dark-error">
							{errorMessage}
						</p>
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4" novalidate>
					<!-- Username -->
					<div>
						<label
							for="username"
							class="mb-1.5 block text-sm font-semibold text-light-black dark:text-dark-white"
						>
							Usuario, Correo, Registro o Carnet
						</label>
						<div
							class="relative flex items-center rounded-xl border-2 transition-all
								{fieldErrors.username
									? 'border-light-error dark:border-dark-error'
									: 'border-light-four dark:border-dark-border'}
								bg-light-primary focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10
								dark:bg-dark-primary"
						>
							<UserIcon
								class="ml-3.5 size-5 shrink-0 text-light-four dark:text-dark-four"
							/>
							<input
								id="username"
								type="text"
								bind:value={username}
								oninput={() => fieldErrors.username && validateField('username')}
								onblur={() => { usernameFocused = false; validateField('username'); }}
								onfocus={() => (usernameFocused = true)}
								onkeypress={handleKeyPress}
								class="w-full bg-transparent py-3.5 pr-4 pl-3 text-base text-light-black outline-none transition-all placeholder:text-light-four/60 dark:text-dark-white dark:placeholder:text-dark-four/60"
								placeholder="Correo, registro o carnet"
								disabled={isLoading}
								autocomplete="username"
								aria-invalid={!!fieldErrors.username}
								aria-describedby={fieldErrors.username ? 'username-error' : undefined}
							/>
						</div>
						{#if fieldErrors.username}
							<p
								id="username-error"
								role="alert"
								class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-light-error dark:text-dark-error"
							>
								<ExclamationCircleIcon class="size-3.5 shrink-0" />
								{fieldErrors.username}
							</p>
						{/if}
					</div>

					<!-- Password -->
					<div>
						<label
							for="password"
							class="mb-1.5 block text-sm font-semibold text-light-black dark:text-dark-white"
						>
							Contraseña
						</label>
						<div
							class="relative flex items-center rounded-xl border-2 transition-all
								{fieldErrors.password
									? 'border-light-error dark:border-dark-error'
									: 'border-light-four dark:border-dark-border'}
								bg-light-primary focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10
								dark:bg-dark-primary"
						>
							<LockIcon
								class="ml-3.5 size-5 shrink-0 text-light-four dark:text-dark-four"
							/>
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								oninput={() => fieldErrors.password && validateField('password')}
								onblur={() => { passwordFocused = false; validateField('password'); }}
								onfocus={() => (passwordFocused = true)}
								onkeypress={handleKeyPress}
								class="w-full bg-transparent py-3.5 pr-12 pl-3 text-base text-light-black outline-none transition-all placeholder:text-light-four/60 dark:text-dark-white dark:placeholder:text-dark-four/60"
								placeholder="••••••••"
								disabled={isLoading}
								autocomplete="current-password"
								aria-invalid={!!fieldErrors.password}
								aria-describedby={fieldErrors.password ? 'password-error' : undefined}
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="mr-1.5 flex size-10 items-center justify-center rounded-lg text-light-four transition-colors hover:bg-light-four/20 hover:text-light-black focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-dark-four dark:hover:bg-dark-four/20 dark:hover:text-dark-white"
								disabled={isLoading}
								aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
								aria-pressed={showPassword}
							>
								{#if showPassword}
									<EyeOffIcon class="size-5" />
								{:else}
									<EyeIcon class="size-5" />
								{/if}
							</button>
						</div>
						{#if fieldErrors.password}
							<p
								id="password-error"
								role="alert"
								class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-light-error dark:text-dark-error"
							>
								<ExclamationCircleIcon class="size-3.5 shrink-0" />
								{fieldErrors.password}
							</p>
						{/if}
					</div>

					<!-- Submit button -->
					<Button
						onclick={handleSubmit}
						disabled={isLoading}
						fullWidth
						loading={isLoading}
						size="lg"
						class="mt-2 shadow-lg shadow-primary-600/20 hover:shadow-xl hover:shadow-primary-600/30"
					>
						{#snippet rightIcon()}
							{#if !isLoading}
								<ChevronRightIcon class="size-5" />
							{/if}
						{/snippet}
						Iniciar Sesión
					</Button>
				</form>

				<!-- Divider -->
				<div class="my-6 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
					<div class="h-px flex-1 bg-gray-200 dark:bg-dark-border"></div>
					<span class="font-medium uppercase tracking-wider">¿Necesitas ayuda?</span>
					<div class="h-px flex-1 bg-gray-200 dark:bg-dark-border"></div>
				</div>

				<!-- Help links -->
				<div class="space-y-2.5 text-center">
					<p class="text-sm">
						<a
							href="/auth/forgot-password"
							class="font-semibold text-primary-600 underline-offset-4 transition-colors hover:text-primary-700 hover:underline dark:text-dark-tertiary dark:hover:text-dark-secondary"
						>
							¿Olvidaste tu contraseña?
						</a>
					</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						¿No tienes cuenta?
						<a
							href="/auth/register"
							class="font-semibold text-primary-600 underline-offset-4 transition-colors hover:text-primary-700 hover:underline dark:text-dark-tertiary dark:hover:text-dark-secondary"
						>
							Solicítala aquí
						</a>
					</p>
				</div>
			</div>

			<!-- Trust signals / Footer institucional -->
			<div class="mt-8 text-center">
				<p class="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
					Sistema de Gestión Académica y Financiera
				</p>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					© {new Date().getFullYear()} Unidad de Postgrado · UAGRM
				</p>
			</div>
		</div>
	</div>
</div>
