<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { Button } from '$lib/components/ui';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let token = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let done = $state(false);
	let errorMsg = $state('');

	onMount(() => {
		token = $page.url.searchParams.get('token') || '';
	});

	async function handleSubmit() {
		errorMsg = '';
		if (!token) {
			errorMsg = 'Enlace inválido. Solicita uno nuevo desde "Recuperar contraseña".';
			return;
		}
		if (newPassword.length < 5) {
			errorMsg = 'La contraseña debe tener al menos 5 caracteres.';
			return;
		}
		if (newPassword !== confirmPassword) {
			errorMsg = 'Las contraseñas no coinciden.';
			return;
		}
		loading = true;
		try {
			await apiKyC.postPublic('/auth/reset-password', { token, new_password: newPassword });
			done = true;
		} catch (e: any) {
			errorMsg = e?.message || 'No se pudo restablecer la contraseña. El enlace pudo haber expirado.';
		} finally {
			loading = false;
		}
	}
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
			<h1 class="text-base font-bold text-gray-700 dark:text-gray-300 text-center mt-4">Nueva contraseña</h1>
		</div>

		<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm p-6">
			{#if done}
				<div class="text-center py-4">
					<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<svg class="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">¡Contraseña actualizada!</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Ya puedes iniciar sesión con tu nueva contraseña.</p>
					<Button class="mt-5" onclick={() => goto('/auth/sign-in')}>Iniciar sesión</Button>
				</div>
			{:else}
				{#if errorMsg}
					<div class="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-light-error">{errorMsg}</div>
				{/if}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<div>
						<label for="rp-new" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nueva contraseña</label>
						<input id="rp-new" bind:value={newPassword} type="password" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Mínimo 5 caracteres" />
					</div>
					<div>
						<label for="rp-confirm" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Confirmar contraseña</label>
						<input id="rp-confirm" bind:value={confirmPassword} type="password" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Repite la contraseña" />
					</div>
					<Button onclick={handleSubmit} fullWidth loading={loading} disabled={loading}>Guardar contraseña</Button>
				</form>
				<p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
					<a href="/auth/sign-in" class="font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400">Volver al inicio de sesión</a>
				</p>
			{/if}
		</div>
	</div>
</div>
