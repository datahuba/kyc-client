<script lang="ts">
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { Button } from '$lib/components/ui';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let errorMsg = $state('');

	async function handleSubmit() {
		errorMsg = '';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			errorMsg = 'Ingresa un correo electrónico válido.';
			return;
		}
		loading = true;
		try {
			await apiKyC.postPublic('/auth/forgot-password', { email: email.trim().toLowerCase() });
			sent = true;
		} catch (e: any) {
			errorMsg = e?.message || 'No se pudo procesar la solicitud. Intenta más tarde.';
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
			<h1 class="text-xl font-extrabold text-light-secondary dark:text-dark-tertiary text-center">Recuperar contraseña</h1>
			<p class="text-sm text-light-tertiary dark:text-dark-secondary text-center">Escuela de Posgrado · Contaduría Pública UAGRM</p>
		</div>

		<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm p-6">
			{#if sent}
				<div class="text-center py-4">
					<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<svg class="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">Revisa tu correo</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. El enlace vence en 30 minutos.
					</p>
					<a href="/auth/sign-in" class="mt-5 inline-block font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400">Volver al inicio de sesión</a>
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
					Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
				</p>
				{#if errorMsg}
					<div class="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-light-error">{errorMsg}</div>
				{/if}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<div>
						<label for="fp-email" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
						<input id="fp-email" bind:value={email} type="email" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="correo@ejemplo.com" />
					</div>
					<Button onclick={handleSubmit} fullWidth loading={loading} disabled={loading}>Enviar enlace</Button>
				</form>
				<p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
					<a href="/auth/sign-in" class="font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400">Volver al inicio de sesión</a>
				</p>
			{/if}
		</div>
	</div>
</div>
