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
	import { getRouteByRole } from '$lib/utils/navigation';

	let showPassword = false;
	let username = '';
	let password = '';
	let errorMessage = '';
	let isLoading = false;
	let loginType: 'admin' | 'student' | null = null;

	onMount(() => {
		userStore.subscribe(state => {
			loginType = state.loginType;
		});
		
		const storedType = localStorage.getItem('login_type');
		if (!storedType && !loginType) {
			goto('/');
		}
	});

	async function handleSubmit() {
		errorMessage = '';
		isLoading = true;
		try {
			await userStore.login({ username, password });
			const state = get(userStore);
			if (state.user) {
				const route = getRouteByRole(state.role);
				goto(route);
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
</script>

<div class="relative flex min-h-dvh">
	<div
		class="relative z-20 flex flex-1 items-center justify-center bg-light-primary p-8 dark:bg-dark-primary"
	>
		<div class="w-full max-w-md">
			<!-- Mobile Logo -->
			<div class="mb-10 flex flex-col items-center justify-center">
				<div class="mb-4 flex h-32 w-32 items-center justify-center">
					<img src="/images/logo_empty_datahub.png" alt="" />
				</div>
				<span class="text-3xl font-bold text-light-secondary dark:text-dark-secondary"
					>DataHub<span class="ml-2 text-light-tertiary dark:text-dark-tertiary">Analytics</span
					></span
				>
				{#if loginType}
					<span class="mt-2 text-lg font-medium text-light-black/60 dark:text-dark-white/60">
						{loginType === 'student' ? 'Estudiante' : 'Administrativo'}
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
						Usuario o Email
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
							placeholder="usuario@ejemplo.com"
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

			<!-- Switch Role -->
			<div class="mt-6 text-center">
				<button
					type="button"
					onclick={() => {
						userStore.setLoginType(null);
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
