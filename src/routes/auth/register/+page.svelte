<script lang="ts">
	import { goto } from '$app/navigation';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { Button } from '$lib/components/ui';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let nombre = $state('');
	let email = $state('');
	let carnet = $state('');
	let celular = $state('');
	let registro = $state('');
	let tipo = $state<'interno' | 'externo'>('externo');
	let mensaje = $state('');

	let loading = $state(false);
	let errorMsg = $state('');
	let success = $state(false);

	function validar(): string | null {
		if (nombre.trim().length < 3) return 'Ingresa tu nombre completo.';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Ingresa un correo electrónico válido.';
		if (!/^\d{4,20}$/.test(carnet.trim())) return 'El carnet debe contener solo números (4 a 20 dígitos).';
		if (celular.trim() && !/^\d{6,20}$/.test(celular.trim())) return 'El celular debe contener solo números.';
		return null;
	}

	async function handleSubmit() {
		errorMsg = '';
		const err = validar();
		if (err) {
			errorMsg = err;
			return;
		}
		loading = true;
		try {
			await apiKyC.postPublic('/account-requests/', {
				nombre: nombre.trim(),
				email: email.trim().toLowerCase(),
				carnet: carnet.trim(),
				celular: celular.trim() || undefined,
				registro: registro.trim() || undefined,
				es_estudiante_interno: tipo,
				mensaje: mensaje.trim() || undefined
			});
			success = true;
		} catch (e: any) {
			errorMsg = e?.message || 'No se pudo enviar la solicitud. Intenta más tarde.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="relative min-h-dvh flex items-center justify-center bg-light-primary dark:bg-dark-primary p-4">
	<div class="absolute top-4 right-4 z-30"><ThemeToggle /></div>

	<div class="w-full max-w-lg">
		<!-- Encabezado institucional -->
		<div class="mb-6 flex flex-col items-center">
			<div class="mb-3 flex items-center gap-3">
				<img src="/images/logo_uagrm_fondo_blanco.jpg" alt="UAGRM" class="h-16 w-16 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5" />
				<img src="/images/logo_contaduria_publica_fondo_blanco.jpg" alt="Contaduría Pública" class="h-16 w-16 rounded-xl object-contain bg-white p-1.5 shadow-sm ring-1 ring-black/5" />
			</div>
			<h1 class="text-xl font-extrabold text-light-secondary dark:text-dark-tertiary text-center">Solicitud de Cuenta</h1>
			<p class="text-sm text-light-tertiary dark:text-dark-secondary text-center">Escuela de Postgrado · Contaduría Pública UAGRM</p>
		</div>

		<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm p-6">
			{#if success}
				<div class="text-center py-6">
					<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<svg class="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">¡Solicitud enviada!</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Tu solicitud fue recibida y será revisada por el personal académico (CPD). Te contactaremos al correo indicado una vez sea aprobada.
					</p>
					<Button class="mt-5" onclick={() => goto('/auth/sign-in')}>Volver al inicio de sesión</Button>
				</div>
			{:else}
				{#if errorMsg}
					<div class="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 text-sm text-light-error">{errorMsg}</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<div>
						<label for="r-nombre" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
						<input id="r-nombre" bind:value={nombre} type="text" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Apellidos y Nombres" />
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="r-carnet" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Carnet de Identidad *</label>
							<input id="r-carnet" bind:value={carnet} type="text" inputmode="numeric" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Solo números" />
						</div>
						<div>
							<label for="r-registro" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Registro <span class="text-gray-400 font-normal">(opcional)</span></label>
							<input id="r-registro" bind:value={registro} type="text" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Registro académico" />
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="r-email" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Correo electrónico *</label>
							<input id="r-email" bind:value={email} type="email" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="correo@ejemplo.com" />
						</div>
						<div>
							<label for="r-celular" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Celular <span class="text-gray-400 font-normal">(opcional)</span></label>
							<input id="r-celular" bind:value={celular} type="tel" inputmode="numeric" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Solo números" />
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="r-tipo" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tipo de estudiante</label>
							<select id="r-tipo" bind:value={tipo} class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500">
								<option value="externo">Externo (Público General)</option>
								<option value="interno">Interno (UAGRM)</option>
							</select>
						</div>
					</div>

					<div>
						<label for="r-mensaje" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Programa de interés / Mensaje <span class="text-gray-400 font-normal">(opcional)</span></label>
						<textarea id="r-mensaje" bind:value={mensaje} rows="3" class="block w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ej: Me interesa el Diplomado en..."></textarea>
					</div>

					<Button onclick={handleSubmit} fullWidth loading={loading} disabled={loading}>Enviar solicitud</Button>
				</form>

				<p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
					¿Ya tienes cuenta?
					<a href="/auth/sign-in" class="font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400">Inicia sesión</a>
				</p>
			{/if}
		</div>
	</div>
</div>
