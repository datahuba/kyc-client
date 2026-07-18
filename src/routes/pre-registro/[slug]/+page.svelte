<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { getPublicForm, submitPublicForm } from '$lib/services/pre-registration.service';
	import type { PreRegistrationForm } from '$lib/services/pre-registration.service';
	import Button from '$lib/components/ui/button.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { ExclamationCircleIcon } from '$lib/icons/solid';
	import { ChevronRightIcon, ChevronLeftIcon, CheckIcon } from '$lib/icons/outline';
	import { goto } from '$app/navigation';

	let slug = $derived($page.params.slug);

	let form: PreRegistrationForm | null = $state(null);
	let loading = $state(true);
	let errorMessage = $state('');
	let submitting = $state(false);
	let success = $state(false);

	// Form data
	let nombre = $state('');
	let email = $state('');
	let carnet = $state('');
	let extension = $state('');
	let celular = $state('');
	let fechaNacimiento = $state('');
	let sexo = $state<'' | 'masculino' | 'femenino'>('');
	let domicilio = $state('');
	let mensaje = $state('');

	let fieldErrors = $state<Record<string, string>>({});

	// Countdown
	let now = $state(Date.now());
	let timer: any;
	onMount(() => {
		timer = setInterval(() => (now = Date.now()), 1000);
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	let timeRemaining = $derived.by(() => {
		if (!form) return null;
		const fin = new Date(form.fecha_fin).getTime();
		const diff = fin - now;
		if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		return { expired: false, days, hours, minutes, seconds };
	});

	let isExpired = $derived(timeRemaining?.expired ?? false);

	onMount(async () => {
		await loadForm();
	});

	async function loadForm() {
		loading = true;
		try {
			form = await getPublicForm(slug);
		} catch (e: any) {
			errorMessage = e?.message || 'No se pudo cargar el formulario.';
		} finally {
			loading = false;
		}
	}

	function validate(): boolean {
		const errors: Record<string, string> = {};
		if (!nombre.trim() || nombre.trim().length < 3) {
			errors.nombre = 'Ingresa tu nombre completo.';
		}
		if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			errors.email = 'Ingresa un correo electrónico válido.';
		}
		if (!carnet.trim() || !/^\d{4,20}$/.test(carnet.trim())) {
			errors.carnet = 'El CI debe tener entre 4 y 20 dígitos.';
		}
		if (!celular.trim() || !/^\d{6,20}$/.test(celular.trim())) {
			errors.celular = 'El celular debe tener entre 6 y 20 dígitos.';
		}
		if (fechaNacimiento && !/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(fechaNacimiento.trim())) {
			errors.fechaNacimiento = 'Formato: DD/MM/AAAA o YYYY-MM-DD.';
		}
		fieldErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!form) return;
		if (isExpired) {
			alert('error', 'La fecha límite de este formulario ya pasó.');
			return;
		}
		if (!validate()) return;

		submitting = true;
		try {
			await submitPublicForm(slug, {
				nombre: nombre.trim(),
				email: email.trim().toLowerCase(),
				carnet: carnet.trim(),
				extension: extension.trim() || undefined,
				celular: celular.trim(),
				fecha_nacimiento: fechaNacimiento.trim() || undefined,
				sexo: (sexo || undefined) as 'masculino' | 'femenino' | undefined,
				domicilio: domicilio.trim() || undefined,
				mensaje: mensaje.trim() || undefined
			});
			success = true;
		} catch (e: any) {
			errorMessage = e?.message || 'No se pudo enviar la pre-inscripción.';
		} finally {
			submitting = false;
		}
	}

	function pad(n: number) {
		return n.toString().padStart(2, '0');
	}
</script>

<div
	class="relative min-h-dvh overflow-hidden bg-gradient-to-br from-primary-50 via-white to-uagrm-blue/5 dark:from-dark-background dark:via-dark-primary dark:to-dark-background"
>
	<div class="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
		<div class="absolute -top-40 -right-40 size-[28rem] rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20"></div>
		<div class="absolute -bottom-40 -left-40 size-[28rem] rounded-full bg-uagrm-sky/20 blur-3xl dark:bg-uagrm-sky/10"></div>
	</div>

	<div class="absolute top-4 right-4 z-50 flex items-center gap-2">
		<button
			type="button"
			onclick={() => goto('/')}
			class="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-primary-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md active:scale-95 dark:bg-dark-surface/80 dark:text-dark-tertiary dark:hover:bg-dark-surface"
			aria-label="Volver al inicio"
		>
			<ChevronLeftIcon class="size-4" />
			<span>Inicio</span>
		</button>
		<ThemeToggle />
	</div>

	<div class="relative z-10 flex min-h-dvh flex-col items-center justify-start px-4 py-10 sm:px-6 sm:py-12">
		<div class="w-full max-w-2xl">
			<!-- Header -->
			<div class="mb-6 flex flex-col items-center text-center">
				<div class="mb-3 flex items-center gap-3 sm:gap-4">
					<img src="/images/logo_uagrm_fondo_blanco.jpg" alt="UAGRM" class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-contain bg-white p-1 shadow-md ring-1 ring-primary-100 sm:p-1.5" />
					<img src="/images/logo_contaduria_publica_fondo_blanco.jpg" alt="Contaduría" class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-contain bg-white p-1 shadow-md ring-1 ring-primary-100 sm:p-1.5" />
				</div>
				<h1 class="text-xl font-extrabold text-primary-700 sm:text-2xl dark:text-dark-tertiary">
					{form?.nombre || 'Pre-inscripción'}
				</h1>
				{#if form?.descripcion}
					<p class="mt-2 max-w-lg text-sm text-gray-600 dark:text-gray-300 sm:text-base">
						{form.descripcion}
					</p>
				{/if}
			</div>

			{#if loading}
				<div class="flex justify-center py-20">
					<div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
				</div>
			{:else if errorMessage && !form}
				<div class="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-md dark:border-red-900/50 dark:bg-dark-surface">
					<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<ExclamationCircleIcon class="size-7 text-red-600 dark:text-red-400" />
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">Formulario no disponible</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
				</div>
			{:else if success}
				<div class="rounded-2xl border border-green-200 bg-white p-6 text-center shadow-md dark:border-green-900/50 dark:bg-dark-surface">
					<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<CheckIcon class="size-7 text-green-600 dark:text-green-400" />
					</div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-white">¡Pre-inscripción enviada!</h2>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Tu solicitud fue recibida y será revisada por el equipo académico. Te contactaremos al correo indicado una vez sea aprobada.
					</p>
				</div>
			{:else if form}
				<!-- Countdown -->
				{#if timeRemaining && !isExpired}
					<div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
						<div class="flex items-center justify-center gap-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
							<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
							</svg>
							<span>Tiempo restante para llenar este formulario:</span>
						</div>
						<div class="mt-2 flex items-center justify-center gap-2 font-mono text-2xl font-bold text-amber-900 dark:text-amber-100">
							<span class="rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-dark-surface">{timeRemaining.days}d</span>
							<span>:</span>
							<span class="rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-dark-surface">{pad(timeRemaining.hours)}h</span>
							<span>:</span>
							<span class="rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-dark-surface">{pad(timeRemaining.minutes)}m</span>
							<span>:</span>
							<span class="rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-dark-surface">{pad(timeRemaining.seconds)}s</span>
						</div>
					</div>
				{:else if isExpired}
					<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
						<strong>Este formulario ya cerró.</strong> Ya no se aceptan más respuestas.
					</div>
				{/if}

				<!-- Form -->
				<form
					onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
					class="rounded-2xl border border-gray-200/60 bg-white/95 p-6 shadow-xl shadow-primary-900/5 backdrop-blur-md sm:p-8 dark:border-dark-border/60 dark:bg-dark-surface/95 dark:shadow-black/20"
				>
					<header class="mb-5">
						<h2 class="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Completa tus datos</h2>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Los campos con * son obligatorios.</p>
					</header>

					<div class="space-y-4">
						<!-- Nombre -->
						<div>
							<label for="pr-nombre" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
							<input
								id="pr-nombre"
								type="text"
								bind:value={nombre}
								oninput={() => delete fieldErrors.nombre}
								class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
									{fieldErrors.nombre ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
								placeholder="Apellidos y Nombres"
								disabled={isExpired || submitting}
								autocomplete="name"
								aria-invalid={!!fieldErrors.nombre}
								aria-describedby={fieldErrors.nombre ? 'pr-nombre-error' : undefined}
							/>
							{#if fieldErrors.nombre}
								<p id="pr-nombre-error" class="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p>
							{/if}
						</div>

						<!-- Email -->
						<div>
							<label for="pr-email" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Correo electrónico *</label>
							<input
								id="pr-email"
								type="email"
								bind:value={email}
								oninput={() => delete fieldErrors.email}
								class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
									{fieldErrors.email ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
								placeholder="correo@ejemplo.com"
								disabled={isExpired || submitting}
								autocomplete="email"
								aria-invalid={!!fieldErrors.email}
								aria-describedby={fieldErrors.email ? 'pr-email-error' : undefined}
							/>
							{#if fieldErrors.email}
								<p id="pr-email-error" class="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
							{/if}
						</div>

						<!-- CI + Extensión -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="pr-carnet" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">CI *</label>
								<input
									id="pr-carnet"
									type="text"
									inputmode="numeric"
									bind:value={carnet}
									oninput={() => delete fieldErrors.carnet}
									class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
										{fieldErrors.carnet ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
									placeholder="Solo números"
									disabled={isExpired || submitting}
									aria-invalid={!!fieldErrors.carnet}
									aria-describedby={fieldErrors.carnet ? 'pr-carnet-error' : undefined}
								/>
								{#if fieldErrors.carnet}
									<p id="pr-carnet-error" class="mt-1 text-xs text-red-600">{fieldErrors.carnet}</p>
								{/if}
							</div>
							<div>
								<label for="pr-extension" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Extensión</label>
								<input
									id="pr-extension"
									type="text"
									bind:value={extension}
									class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
									placeholder="SC, LPZ, CBBA..."
									maxlength="10"
									disabled={isExpired || submitting}
								/>
							</div>
						</div>

						<!-- Celular -->
						<div>
							<label for="pr-celular" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Celular *</label>
							<input
								id="pr-celular"
								type="tel"
								inputmode="numeric"
								bind:value={celular}
								oninput={() => delete fieldErrors.celular}
								class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
									{fieldErrors.celular ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
								placeholder="Solo números"
								disabled={isExpired || submitting}
								autocomplete="tel"
								aria-invalid={!!fieldErrors.celular}
								aria-describedby={fieldErrors.celular ? 'pr-celular-error' : undefined}
							/>
							{#if fieldErrors.celular}
								<p id="pr-celular-error" class="mt-1 text-xs text-red-600">{fieldErrors.celular}</p>
							{/if}
						</div>

						<!-- Fecha de nacimiento + Sexo -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label for="pr-fecha" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Fecha de nacimiento</label>
								<input
									id="pr-fecha"
									type="text"
									bind:value={fechaNacimiento}
									oninput={() => delete fieldErrors.fechaNacimiento}
									class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
										{fieldErrors.fechaNacimiento ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
									placeholder="DD/MM/AAAA"
									disabled={isExpired || submitting}
									aria-invalid={!!fieldErrors.fechaNacimiento}
									aria-describedby={fieldErrors.fechaNacimiento ? 'pr-fecha-error' : undefined}
								/>
								{#if fieldErrors.fechaNacimiento}
									<p id="pr-fecha-error" class="mt-1 text-xs text-red-600">{fieldErrors.fechaNacimiento}</p>
								{/if}
							</div>
							<div>
								<label for="pr-sexo" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sexo</label>
								<select
									id="pr-sexo"
									bind:value={sexo}
									class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
									disabled={isExpired || submitting}
								>
									<option value="">— Prefiero no decir —</option>
									<option value="masculino">Masculino</option>
									<option value="femenino">Femenino</option>
								</select>
							</div>
						</div>

						<!-- Domicilio -->
						<div>
							<label for="pr-domicilio" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Domicilio</label>
							<input
								id="pr-domicilio"
								type="text"
								bind:value={domicilio}
								class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
								placeholder="Calle, número, ciudad"
								disabled={isExpired || submitting}
								autocomplete="street-address"
							/>
						</div>

						<!-- Mensaje -->
						<div>
							<label for="pr-mensaje" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mensaje (opcional)</label>
							<textarea
								id="pr-mensaje"
								bind:value={mensaje}
								rows="3"
								class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
								placeholder="¿Algún comentario o consulta?"
								disabled={isExpired || submitting}
							></textarea>
						</div>

						<Button
							onclick={handleSubmit}
							disabled={isExpired || submitting}
							loading={submitting}
							fullWidth
							size="lg"
							class="mt-2 shadow-lg shadow-primary-600/20 hover:shadow-xl hover:shadow-primary-600/30"
						>
							{#snippet rightIcon()}
								{#if !submitting}
									<ChevronRightIcon class="size-5" />
								{/if}
							{/snippet}
							{isExpired ? 'Formulario cerrado' : 'Enviar Pre-inscripción'}
						</Button>
					</div>
				</form>
			{/if}

			<p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
				Sistema de Gestión Académica y Financiera · © {new Date().getFullYear()} Unidad de Postgrado · UAGRM
			</p>
		</div>
	</div>
</div>
