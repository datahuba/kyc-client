<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import { ChevronLeftIcon, EyeIcon, EyeOffIcon } from '$lib/icons/outline';
	import CheckIcon from '$lib/icons/outline/checkIcon.svelte';
	import UserIcon from '$lib/icons/outline/userIcon.svelte';
	import { ExclamationCircleIcon, LockIcon } from '$lib/icons/solid';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { LOGIN_TYPE_KEY } from '$lib/constants';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import PWAInstallButton from '$lib/components/ui/PWAInstallButton.svelte';

	let showPassword = false;
	let username = '';
	let password = '';
	let errorMessage = '';
	let isLoading = false;
	let loginType: 'admin' | 'academic' | null = null;
	let academicRole: 'teacher' | 'student' | null = null;

	onMount(() => {
		userStore.init();

		const unsubscribe = userStore.subscribe(state => {
			loginType = state.loginType;
			academicRole = state.academicRole;
		});
		
		const storedType = localStorage.getItem(LOGIN_TYPE_KEY);
		if (!storedType && !loginType) {
			goto('/');
		}

		return unsubscribe;
	});

	async function handleSubmit() {
		errorMessage = '';
		isLoading = true;
		try {
			await userStore.login({ username, password });
			const state = get(userStore);
			
			if (state.user) {
				// Resolver rol de forma altamente defensiva
				const userRole = state.role || state.user?.rol || state.user?.role || '';
				const currentAcademicRole = state.academicRole || '';

				// ISSUE M: Enrutador Conmutador Inteligente Post-Auth de la UAGRM
				if ((userRole as string) === 'student' || currentAcademicRole === 'student') {
					goto('/app/dashboard'); // Estudiante va a su respectivo Dashboard académico
				} else if ((userRole as string) === 'teacher' || userRole === 'docente' || currentAcademicRole === 'teacher') {
					goto('/app/dashboard'); // Docente va a su respectivo Dashboard académico
				} else if (userRole === 'cpd') {
					goto('/app/students'); // CPD no tiene acceso financiero, inicia directo en gestión de estudiantes
				} else {
					goto('/app/dashboard'); // MAE, Cobranzas, Admin y SuperAdmin globales
				}
			} else {
				goto('/');
			}
		} catch (error: any) {
			console.error(error);
			errorMessage = error.message || 'Error al iniciar sesión';
		} finally {
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
</script>

<div class="relative flex min-h-dvh" style="padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px);">
	<div class="absolute top-4 right-4 z-50 flex items-center gap-4">
		<PWAInstallButton />
		<ThemeToggle />
	</div>
	<div
		class="relative z-20 flex flex-1 items-center justify-center bg-light-primary p-5 sm:p-8 dark:bg-dark-primary"
	>
		<div class="w-full max-w-md pt-4 sm:pt-0">
			<!-- Logo institucional UAGRM -->
			<div class="mb-10 flex flex-col items-center justify-center">
				<div class="mb-4 flex items-center gap-3">
					<img
						src="/images/logo_uagrm_fondo_blanco.jpg"
						alt="UAGRM"
						class="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5"
					/>
					<img
						src="/images/logo_contaduria_publica_fondo_blanco.jpg"
						alt="Facultad de Contaduría Pública"
						class="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5"
					/>
				</div>
				<span class="text-2xl font-extrabold text-light-secondary dark:text-dark-tertiary text-center leading-tight">
					Unidad de Postgrado
				</span>
				<span class="text-xs font-semibold text-light-tertiary dark:text-dark-secondary text-center max-w-sm mt-1 px-4 leading-normal">
					Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y Finanzas
				</span>
				{#if loginType}
					<span class="mt-2 text-lg font-medium text-light-black/60 dark:text-dark-white/60">
						{getLoginTypeLabel()}
					</span>
				{/if}
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<div
					class="mb-6 flex items-start rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
				>
					<ExclamationCircleIcon
						class="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-light-error dark:text-dark-error"
					/>
					<p class="text-sm text-light-error dark:text-dark-error">{errorMessage}</p>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Username -->
				<div>
					<label
						for="username"
						class="mb-2 block text-sm font-semibold text-light-black dark:text-dark-white"
					>
						Usuario, Correo, Registro o Carnet
					</label>
					<div class="relative">
						<UserIcon
							class="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-light-four dark:text-dark-four"
						/>
						<input
							id="username"
							type="text"
							bind:value={username}
							onkeypress={handleKeyPress}
							class="w-full rounded-xl border-2 border-light-four bg-light-primary py-3.5 pr-4 pl-12 text-light-black transition-all outline-none placeholder:text-light-four/50 hover:border-light-four focus:border-light-tertiary dark:border-dark-four dark:bg-dark-primary dark:text-dark-white dark:placeholder:text-dark-four dark:hover:border-dark-four dark:focus:border-dark-tertiary dark:focus:ring-dark-tertiary"
							placeholder="Correo, registro o carnet"
							disabled={isLoading}
						/>
					</div>
				</div>

				<!-- Password -->
				<div>
					<label
						for="password"
						class="mb-2 block text-sm font-semibold text-light-black dark:text-dark-white"
					>
						Contraseña
					</label>
					<div class="relative">
						<LockIcon
							class="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-light-four dark:text-dark-four"
						/>
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							onkeypress={handleKeyPress}
							class="w-full rounded-xl border-2 border-light-four bg-light-primary py-3.5 pr-12 pl-12 text-light-black transition-all outline-none placeholder:text-light-four/50 hover:border-light-four focus:border-light-tertiary dark:border-dark-four dark:bg-dark-primary dark:text-dark-white dark:placeholder:text-dark-four/50 dark:hover:border-dark-four dark:focus:border-dark-tertiary dark:focus:ring-dark-tertiary"
							placeholder="••••••••"
							disabled={isLoading}
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-4 -translate-y-1/2 text-light-black transition-colors hover:text-light-four dark:text-dark-white"
							disabled={isLoading}
						>
							{#if showPassword}
								<EyeIcon class="h-5 w-5" />
							{:else}
								<EyeOffIcon class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Forgot Password -->
				<!-- <div class="flex justify-end">
					<button
						type="button"
						class="text-sm font-semibold text-light-tertiary transition-colors hover:text-light-tertiary_d dark:text-dark-tertiary dark:hover:text-dark-tertiary_d"
					>
						¿Olvidaste tu contraseña?
					</button>
				</div> -->

				<Button onclick={handleSubmit} disabled={isLoading} fullWidth {isLoading} loading={isLoading}>
					Iniciar Sesión
				</Button>
			</form>

			<!-- Recuperar cuenta y solicitud -->
			<div class="mt-5 space-y-2 text-center">
				<p class="text-sm">
					<a href="/auth/forgot-password" class="font-semibold text-light-tertiary hover:text-light-tertiary_d dark:text-dark-tertiary underline">
						¿Olvidaste tu contraseña?
					</a>
				</p>
				<p class="text-sm text-light-black/70 dark:text-dark-white/70">
					¿No tienes cuenta?
					<a href="/auth/register" class="font-semibold text-light-tertiary hover:text-light-tertiary_d dark:text-dark-tertiary underline">
						Solicítala aquí
					</a>
				</p>
			</div>

			<!-- Switch Role -->
			<div class="mt-6 text-center">
				<button
					type="button"
					onclick={() => {
						userStore.setLoginType(null);
						userStore.setAcademicRole(null);
						goto('/');
					}}
					class="text-sm font-medium text-light-secondary hover:text-light-secondary_d dark:text-dark-secondary dark:hover:text-dark-secondary_d underline"
				>
					Cambiar tipo de usuario
				</button>
			</div>
	
		</div>
	</div>
</div>
