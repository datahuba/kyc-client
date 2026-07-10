<script lang="ts">
	// ISSUE-A-VERIFICACION: página pública a la que llega el enlace del correo.
	// Se auto-ejecuta al montar (el usuario solo hace clic en el correo, no
	// necesita escribir nada). No bloquea el acceso al sistema si falla.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authService } from '$lib/services';
	import { Button } from '$lib/components/ui';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let status: 'loading' | 'success' | 'error' = $state('loading');
	let errorMsg = $state('');

	onMount(async () => {
		const token = $page.url.searchParams.get('token') || '';
		if (!token) {
			status = 'error';
			errorMsg = 'Enlace inválido. Solicita uno nuevo desde tu perfil.';
			return;
		}
		try {
			await authService.verifyEmail(token);
			status = 'success';
		} catch (e: any) {
			status = 'error';
			errorMsg = e?.message || 'El enlace es inválido o ha expirado. Solicita uno nuevo desde tu perfil.';
		}
	});
</script>

<div class="relative min-h-dvh flex items-center justify-center bg-light-primary dark:bg-dark-primary p-4">
	<div class="absolute top-4 right-4 z-30"><ThemeToggle /></div>

	<div class="w-full max-w-md">
		<div class="mb-6 flex flex-col items-center">
			<div class="mb-3 flex items-center gap-3">
				<img src="/images/logo_uagrm_fondo_blanco.jpg" alt="UAGRM" class="h-16 w-16 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5" />
				<img src="/images/logo_contaduria_publica_fondo_blanco.jpg" alt="Contaduría Pública" class="h-16 w-16 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5" />
			</div>
			<span class="text-xl font-extrabold text-light-secondary dark:text-dark-tertiary text-center leading-tight">Unidad de Postgrado</span>
			<span class="text-xs font-semibold text-light-tertiary dark:text-dark-secondary text-center mt-1 max-w-sm leading-normal">Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y Finanzas</span>
			<h1 class="text-base font-bold text-gray-700 dark:text-gray-300 text-center mt-4">Verificación de correo</h1>
		</div>

		<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm p-6 text-center">
			{#if status === 'loading'}
				<div class="py-4">
					<div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600"></div>
					<p class="text-sm text-gray-500 dark:text-gray-400">Verificando tu correo...</p>
				</div>
			{:else if status === 'success'}
				<div class="py-4">
					<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<svg class="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">¡Correo verificado!</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Ya confirmamos que tu correo es válido y accesible.</p>
					<Button class="mt-5" onclick={() => goto('/auth/sign-in')}>Iniciar sesión</Button>
				</div>
			{:else}
				<div class="py-4">
					<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<svg class="h-7 w-7 text-light-error dark:text-dark-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">No se pudo verificar</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{errorMsg}</p>
					<p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
						Esto no afecta tu acceso al sistema. Puedes solicitar un nuevo enlace desde tu perfil una vez que inicies sesión.
					</p>
					<Button class="mt-5" variant="secondary" onclick={() => goto('/auth/sign-in')}>Ir al inicio de sesión</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
