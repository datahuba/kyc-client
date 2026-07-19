<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { getPublicForm, submitPublicForm } from '$lib/services/pre-registration.service';
	import type { PreRegistrationForm } from '$lib/services/pre-registration.service';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { ExclamationCircleIcon } from '$lib/icons/solid';
	import {
		ChevronRightIcon,
		ChevronLeftIcon,
		CheckIcon,
		UserIcon,
		IdentificationIcon,
		StopwatchIcon,
		CircleCheckIcon,
		CopyIcon
	} from '$lib/icons/outline';
	import { fly, fade, slide } from 'svelte/transition';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';

	let slug = $derived($page.params.slug);

	let form: PreRegistrationForm | null = $state(null);
	let loading = $state(true);
	let errorMessage = $state('');
	let submitting = $state(false);
	let success = $state(false);
	let submissionId = $state(''); // ID devuelto por el backend al enviar
	let copiedEmail = $state(false); // feedback al copiar email

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

	// Wizard state
	const STEPS = [
		{ id: 1, title: 'Identidad', subtitle: '¿Quién eres?', icon: UserIcon, fields: ['nombre', 'email', 'carnet', 'extension'] },
		{ id: 2, title: 'Contacto', subtitle: '¿Cómo te ubicamos?', icon: IdentificationIcon, fields: ['celular', 'fechaNacimiento', 'sexo', 'domicilio'] },
		{ id: 3, title: 'Confirmar', subtitle: 'Revisa y envía', icon: CircleCheckIcon, fields: ['mensaje'] }
	] as const;
	let currentStep = $state(1);
	let highestStepReached = $state(1);
	const TOTAL_STEPS = STEPS.length;
	let justSaved = $state(false);
	let saveTimer: any;

	// Countdown
	let now = $state(Date.now());
	let timer: any;
	onMount(() => {
		timer = setInterval(() => (now = Date.now()), 1000);
		// load autosaved data
		loadAutosave();
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
		if (saveTimer) clearTimeout(saveTimer);
	});

	let timeRemaining = $derived.by(() => {
		if (!form) return null;
		const fin = new Date(form.fecha_fin).getTime();
		const diff = fin - now;
		if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		return { expired: false, days, hours, minutes, seconds };
	});

	let isExpired = $derived(timeRemaining?.expired ?? false);
	let progressPct = $derived(Math.round(((currentStep) / TOTAL_STEPS) * 100));

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

	// ---- Autosave ----
	function autosaveKey() {
		return `pr_autosave_${slug}`;
	}
	function saveAutosave() {
		if (success) return;
		try {
			const data = { nombre, email, carnet, extension, celular, fechaNacimiento, sexo, domicilio, mensaje, currentStep, savedAt: Date.now() };
			localStorage.setItem(autosaveKey(), JSON.stringify(data));
			// indicador "guardado"
			justSaved = true;
			clearTimeout(saveTimer);
			saveTimer = setTimeout(() => (justSaved = false), 1500);
		} catch (e) {
			// localStorage no disponible o lleno
		}
	}
	function loadAutosave() {
		try {
			// ISSUE-PRE-WIZARD-001: pre-llenar email si el usuario ya está autenticado.
			// Esto da UX premium: si ya estás logueado, no necesitas re-tipear el email.
			const userEmail = $userStore?.user?.email;
			if (userEmail && !email) {
				email = userEmail;
			}
			const userName = $userStore?.user?.nombre_funcional || $userStore?.user?.username;
			if (userName && !nombre) {
				nombre = userName;
			}

			const raw = localStorage.getItem(autosaveKey());
			if (!raw) return;
			const data = JSON.parse(raw);
			// Solo restaurar si fue de los últimos 7 días
			if (Date.now() - (data.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
				localStorage.removeItem(autosaveKey());
				return;
			}
			nombre = data.nombre || nombre;
			email = data.email || email;
			carnet = data.carnet || '';
			extension = data.extension || '';
			celular = data.celular || '';
			fechaNacimiento = data.fechaNacimiento || '';
			sexo = data.sexo || '';
			domicilio = data.domicilio || '';
			mensaje = data.mensaje || '';
			if (data.currentStep) {
				currentStep = data.currentStep;
				highestStepReached = data.currentStep;
			}
		} catch (e) {
			// ignore
		}
	}
	function clearAutosave() {
		try {
			localStorage.removeItem(autosaveKey());
		} catch (e) {}
	}

	// ---- Validation ----
	function validateField(key: string): string | null {
		const v = (() => {
			switch (key) {
				case 'nombre': return nombre.trim();
				case 'email': return email.trim();
				case 'carnet': return carnet.trim();
				case 'extension': return extension.trim();
				case 'celular': return celular.trim();
				case 'fechaNacimiento': return fechaNacimiento.trim();
				case 'domicilio': return domicilio.trim();
				case 'mensaje': return mensaje.trim();
				default: return '';
			}
		})();

		if (key === 'nombre') {
			if (v.length < 3) return 'Ingresa tu nombre completo (mínimo 3 caracteres).';
		}
		if (key === 'email') {
			if (!v) return 'El correo es obligatorio.';
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Formato de correo inválido.';
		}
		if (key === 'carnet') {
			if (!v) return 'El CI es obligatorio.';
			if (!/^\d{4,20}$/.test(v)) return 'El CI debe tener entre 4 y 20 dígitos.';
		}
		if (key === 'celular') {
			if (!v) return 'El celular es obligatorio.';
			if (!/^\d{6,20}$/.test(v)) return 'El celular debe tener entre 6 y 20 dígitos.';
		}
		if (key === 'fechaNacimiento' && v) {
			if (!/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(v)) return 'Formato: DD/MM/AAAA o AAAA-MM-DD.';
		}
		return null;
	}

	function validateStep(step: number): boolean {
		const errors: Record<string, string> = {};
		for (const key of STEPS[step - 1].fields) {
			const err = validateField(key);
			if (err) errors[key] = err;
		}
		fieldErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function nextStep() {
		if (isExpired) return;
		if (!validateStep(currentStep)) {
			// scroll al primer error
			setTimeout(() => {
				const firstError = document.querySelector('[aria-invalid="true"]');
				firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 50);
			return;
		}
		if (currentStep < TOTAL_STEPS) {
			currentStep++;
			if (currentStep > highestStepReached) highestStepReached = currentStep;
			saveAutosave();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
			saveAutosave();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
	function goToStep(step: number) {
		if (step <= highestStepReached && step >= 1) {
			currentStep = step;
			saveAutosave();
		}
	}

	function clearError(key: string) {
		if (fieldErrors[key]) {
			const e = { ...fieldErrors };
			delete e[key];
			fieldErrors = e;
		}
	}

	async function handleSubmit() {
		if (!form) return;
		if (isExpired) {
			alert('error', 'La fecha límite de este formulario ya pasó.');
			return;
		}
		// Validar todos los pasos antes de enviar
		for (let s = 1; s <= TOTAL_STEPS; s++) {
			if (!validateStep(s)) {
				currentStep = s;
				return;
			}
		}
		submitting = true;
		try {
			const result = await submitPublicForm(slug, {
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
			// ISSUE-PRE-WIZARD-002: capturar el ID de submission para mostrar al usuario
			submissionId = (result as any)?.id || (result as any)?._id || '';
			success = true;
			clearAutosave();
		} catch (e: any) {
			errorMessage = e?.message || 'No se pudo enviar la pre-inscripción.';
		} finally {
			submitting = false;
		}
	}

	// ISSUE-PRE-WIZARD-003: copiar el email al clipboard (por si el usuario
	// no tiene acceso al email y quiere guardarlo para referencia)
	async function copyEmail() {
		try {
			await navigator.clipboard.writeText(email);
			copiedEmail = true;
			setTimeout(() => (copiedEmail = false), 2000);
		} catch (e) {
			// fallback: seleccionar texto
			const input = document.getElementById('pr-email') as HTMLInputElement;
			input?.select();
		}
	}

	function pad(n: number) {
		return n.toString().padStart(2, '0');
	}

	// Formatear fecha a DD/MM/AAAA cuando es YYYY-MM-DD
	function formatFechaInput(value: string): string {
		if (!value) return '';
		// Si es YYYY-MM-DD, convertir a DD/MM/AAAA
		const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (m) return `${m[3]}/${m[2]}/${m[1]}`;
		return value;
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
				<div class="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-md dark:border-green-900/50 dark:bg-dark-surface" in:fly={{ y: 30, duration: 500, easing: quintOut }}>
					<!-- ISSUE-PRE-WIZARD-002: Confetti-style checkmark con scale -->
					<div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30" in:scale={{ duration: 600, start: 0.5, easing: cubicOut }}>
						<svg xmlns="http://www.w3.org/2000/svg" class="size-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h2 class="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">¡Listo!</h2>
					<p class="mt-3 text-base text-gray-600 dark:text-gray-300">
						Tu pre-inscripción fue recibida y será revisada por el equipo académico.
					</p>

					<!-- ID de submission para referencia -->
					{#if submissionId}
						<div class="mt-5 rounded-xl border border-primary-200 bg-primary-50/50 p-3 dark:border-primary-900/50 dark:bg-primary-900/10" in:fade={{ duration: 400, delay: 200 }}>
							<p class="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-dark-tertiary">Número de solicitud</p>
							<p class="mt-1 font-mono text-sm font-bold text-primary-700 dark:text-dark-tertiary break-all">{submissionId}</p>
							<p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Guarda este número para consultar el estado de tu solicitud</p>
						</div>
					{/if}

					<!-- Email al que se enviará la confirmación + botón copiar -->
					<div class="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-dark-border/30">
						<p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Te contactaremos a</p>
						<div class="mt-1 flex items-center justify-center gap-2">
							<button
								type="button"
								onclick={copyEmail}
								class="group inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-primary-700 transition-all hover:text-primary-800 active:scale-95 dark:text-dark-tertiary"
								aria-label="Copiar email al portapapeles"
							>
								{#if copiedEmail}
									<CheckIcon class="size-4 text-green-600" />
									<span class="text-green-600">¡Copiado!</span>
								{:else}
									<CopyIcon class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
									<span>{email}</span>
									<CopyIcon class="size-3 opacity-50" />
								{/if}
							</button>
						</div>
						<p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Revisa también tu bandeja de spam</p>
					</div>

					<button
						onclick={() => goto('/')}
						class="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-95"
					>
						<ChevronLeftIcon class="size-4" />
						Volver al inicio
					</button>
				</div>
			{:else if form}
				<!-- Countdown -->
				{#if timeRemaining && !isExpired}
					<div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
						<div class="flex items-center justify-center gap-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
							<StopwatchIcon class="size-4" />
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

				<!-- Wizard Stepper (ActivePill pattern) -->
				{#if !isExpired}
					<div class="mb-5">
						<ol class="flex items-center gap-2 sm:gap-3" aria-label="Pasos del formulario">
							{#each STEPS as step, i}
								{@const isActive = currentStep === step.id}
								{@const isComplete = currentStep > step.id}
								{@const isReachable = step.id <= highestStepReached}
								{@const isLast = i === STEPS.length - 1}
								<li class="flex flex-1 items-center gap-2 sm:gap-3">
									<button
										type="button"
										onclick={() => goToStep(step.id)}
										disabled={!isReachable}
										class="group flex min-w-0 flex-1 items-center gap-2 sm:gap-3 rounded-xl px-2 py-2 text-left transition-all
											{isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
											{!isReachable ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 dark:hover:bg-dark-surface/60'}
											{isComplete ? 'cursor-pointer' : ''}"
										aria-current={isActive ? 'step' : undefined}
									>
										<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all
											{isComplete ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30' : ''}
											{isActive ? 'bg-primary-600 text-white shadow-md shadow-primary-600/40 ring-4 ring-primary-200 dark:ring-primary-900/40' : ''}
											{!isComplete && !isActive ? 'bg-gray-200 text-gray-500 dark:bg-dark-border dark:text-gray-400' : ''}">
											{#if isComplete}
												<CheckIcon class="size-4" />
											{:else}
												{step.id}
											{/if}
										</span>
										<span class="min-w-0">
											<span class="block truncate text-xs font-semibold
												{isActive ? 'text-primary-700 dark:text-dark-tertiary' : isComplete ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}">
												{step.title}
											</span>
											<span class="hidden truncate text-[10px] text-gray-400 sm:block dark:text-gray-500">
												{step.subtitle}
											</span>
										</span>
									</button>
									{#if !isLast}
										<div class="h-0.5 w-3 shrink-0 rounded-full transition-all
											{isComplete ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-border'}"></div>
									{/if}
								</li>
							{/each}
						</ol>
						<!-- Progress bar (mobile fallback) -->
						<div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-border">
							<div
								class="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
								style="width: {progressPct}%"
							></div>
						</div>
						<p class="mt-1.5 text-right text-[11px] font-medium text-gray-400 dark:text-gray-500">
							Paso {currentStep} de {TOTAL_STEPS} · {progressPct}%
						</p>
					</div>
				{/if}

				<!-- Form card -->
				<form
					onsubmit={(e) => { e.preventDefault(); }}
					class="rounded-2xl border border-gray-200/60 bg-white/95 p-6 shadow-xl shadow-primary-900/5 backdrop-blur-md sm:p-8 dark:border-dark-border/60 dark:bg-dark-surface/95 dark:shadow-black/20"
				>
					<header class="mb-5 flex items-start justify-between gap-3">
						<div>
							<h2 class="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
								{STEPS[currentStep - 1].title}
							</h2>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								{STEPS[currentStep - 1].subtitle}
							</p>
						</div>
						{#if justSaved}
							<span class="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
								<CheckIcon class="size-3" />
								Guardado
							</span>
						{/if}
					</header>

					<div class="space-y-4">
						<!-- ISSUE-PRE-WIZARD-004: transiciones slide horizontales entre pasos.
						     Cada bloque hace fly in/out al cambiar currentStep. -->
						<!-- ============== PASO 1: Identidad ============== -->
						{#if currentStep === 1}
						<div in:fly={{ x: 20, duration: 350, easing: cubicOut }} out:fly={{ x: -20, duration: 200, easing: cubicOut }}>
							<!-- Nombre -->
							<div>
								<label for="pr-nombre" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Nombre completo <span class="text-red-500">*</span>
								</label>
								<input
									id="pr-nombre"
									type="text"
									bind:value={nombre}
									oninput={() => { clearError('nombre'); saveAutosave(); }}
									class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
										{fieldErrors.nombre ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
									placeholder="Apellidos y Nombres"
									disabled={isExpired}
									autocomplete="name"
									aria-invalid={!!fieldErrors.nombre}
									aria-describedby={fieldErrors.nombre ? 'pr-nombre-error' : undefined}
								/>
								{#if fieldErrors.nombre}
									<p id="pr-nombre-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.nombre}</p>
								{:else}
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Como aparece en tu documento de identidad</p>
								{/if}
							</div>

							<!-- Email -->
							<div>
								<label for="pr-email" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Correo electrónico <span class="text-red-500">*</span>
								</label>
								<input
									id="pr-email"
									type="email"
									bind:value={email}
									oninput={() => { clearError('email'); saveAutosave(); }}
									class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
										{fieldErrors.email ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
									placeholder="tucorreo@ejemplo.com"
									disabled={isExpired}
									autocomplete="email"
									inputmode="email"
									aria-invalid={!!fieldErrors.email}
									aria-describedby={fieldErrors.email ? 'pr-email-error' : undefined}
								/>
								{#if fieldErrors.email}
									<p id="pr-email-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.email}</p>
								{:else}
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Te contactaremos a este correo</p>
								{/if}
							</div>

							<!-- CI + Extensión -->
							<div class="grid grid-cols-3 gap-3">
								<div class="col-span-2">
									<label for="pr-carnet" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Carnet de Identidad <span class="text-red-500">*</span>
									</label>
									<input
										id="pr-carnet"
										type="text"
										inputmode="numeric"
										bind:value={carnet}
										oninput={() => { clearError('carnet'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.carnet ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										placeholder="Solo números"
										disabled={isExpired}
										autocomplete="off"
										aria-invalid={!!fieldErrors.carnet}
										aria-describedby={fieldErrors.carnet ? 'pr-carnet-error' : undefined}
									/>
									{#if fieldErrors.carnet}
										<p id="pr-carnet-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.carnet}</p>
									{/if}
								</div>
								<div>
									<label for="pr-extension" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Extensión
									</label>
									<input
										id="pr-extension"
										type="text"
										bind:value={extension}
										oninput={saveAutosave}
										class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
										placeholder="SC"
										maxlength="4"
										disabled={isExpired}
									/>
								</div>
							</div>
						</div>
						{/if}

						<!-- ============== PASO 2: Contacto ============== -->
						{#if currentStep === 2}
						<div in:fly={{ x: 20, duration: 350, easing: cubicOut }} out:fly={{ x: -20, duration: 200, easing: cubicOut }}>
							<!-- Celular -->
							<div>
								<label for="pr-celular" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Celular <span class="text-red-500">*</span>
								</label>
								<input
									id="pr-celular"
									type="tel"
									inputmode="numeric"
									bind:value={celular}
									oninput={() => { clearError('celular'); saveAutosave(); }}
									class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
										{fieldErrors.celular ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
									placeholder="Solo números"
									disabled={isExpired}
									autocomplete="tel"
									aria-invalid={!!fieldErrors.celular}
									aria-describedby={fieldErrors.celular ? 'pr-celular-error' : undefined}
								/>
								{#if fieldErrors.celular}
									<p id="pr-celular-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.celular}</p>
								{/if}
							</div>

							<!-- Fecha de nacimiento + Sexo -->
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label for="pr-fecha" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Fecha de nacimiento
									</label>
									<input
										id="pr-fecha"
										type="date"
										bind:value={fechaNacimiento}
										oninput={() => { clearError('fechaNacimiento'); saveAutosave(); }}
										max={new Date().toISOString().split('T')[0]}
										min="1940-01-01"
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.fechaNacimiento ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										disabled={isExpired}
										aria-invalid={!!fieldErrors.fechaNacimiento}
										aria-describedby={fieldErrors.fechaNacimiento ? 'pr-fecha-error' : undefined}
									/>
									{#if fieldErrors.fechaNacimiento}
										<p id="pr-fecha-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.fechaNacimiento}</p>
									{:else}
										<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Toca para abrir el calendario</p>
									{/if}
								</div>
								<div>
									<label for="pr-sexo" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Sexo
									</label>
									<select
										id="pr-sexo"
										bind:value={sexo}
										onchange={saveAutosave}
										class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
										disabled={isExpired}
									>
										<option value="">— Prefiero no decir —</option>
										<option value="masculino">Masculino</option>
										<option value="femenino">Femenino</option>
									</select>
								</div>
							</div>

							<!-- Domicilio -->
							<div>
								<label for="pr-domicilio" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Domicilio
								</label>
								<input
									id="pr-domicilio"
									type="text"
									bind:value={domicilio}
									oninput={saveAutosave}
									class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
									placeholder="Calle, número, ciudad"
									disabled={isExpired}
									autocomplete="street-address"
								/>
							</div>
						</div>
						{/if}

						<!-- ============== PASO 3: Confirmar ============== -->
						{#if currentStep === 3}
						<div in:fly={{ x: 20, duration: 350, easing: cubicOut }} out:fly={{ x: -20, duration: 200, easing: cubicOut }}>
							<div class="rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/50 dark:bg-primary-900/10">
								<h3 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-700 dark:text-dark-tertiary">
									<CircleCheckIcon class="size-4" />
									Revisa tus datos antes de enviar
								</h3>
								<dl class="space-y-2 text-sm">
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Nombre</dt>
										<dd class="font-semibold text-gray-900 dark:text-white text-right">{nombre || '—'}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Correo</dt>
										<dd class="font-mono text-xs text-gray-900 dark:text-white text-right break-all">{email || '—'}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">CI</dt>
										<dd class="font-mono text-gray-900 dark:text-white text-right">{carnet}{extension ? ` · ${extension}` : ''}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Celular</dt>
										<dd class="font-mono text-gray-900 dark:text-white text-right">{celular || '—'}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Nacimiento</dt>
										<dd class="text-gray-900 dark:text-white text-right">{formatFechaInput(fechaNacimiento) || '—'}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Sexo</dt>
										<dd class="text-gray-900 dark:text-white text-right capitalize">{sexo || '—'}</dd>
									</div>
									<div class="flex justify-between gap-3">
										<dt class="text-gray-500 dark:text-gray-400">Domicilio</dt>
										<dd class="text-gray-900 dark:text-white text-right max-w-[60%]">{domicilio || '—'}</dd>
									</div>
								</dl>
							</div>

							<!-- Mensaje -->
							<div>
								<label for="pr-mensaje" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									¿Algún comentario o consulta? <span class="text-xs font-normal text-gray-400">(opcional)</span>
								</label>
								<textarea
									id="pr-mensaje"
									bind:value={mensaje}
									oninput={saveAutosave}
									rows="3"
									class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
									placeholder="Cuéntanos brevemente por qué te interesa el programa..."
									disabled={isExpired}
								></textarea>
							</div>

							<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
								<strong>Verifica tu correo:</strong> te enviaremos la confirmación a <span class="font-mono">{email || '(aún no ingresado)'}</span>. Revisa también la bandeja de spam.
							</div>
						</div>
						{/if}
					</div>

					<!-- ============== Wizard Navigation ============== -->
					{#if !isExpired}
						<div class="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 dark:border-dark-border">
							{#if currentStep > 1}
								<button
									type="button"
									onclick={prevStep}
									class="inline-flex items-center gap-1.5 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 active:scale-95 dark:border-dark-border dark:bg-dark-surface dark:text-gray-300 dark:hover:bg-dark-border/50"
								>
									<ChevronLeftIcon class="size-4" />
									Atrás
								</button>
							{:else}
								<div></div>
							{/if}

							{#if currentStep < TOTAL_STEPS}
								<button
									type="button"
									onclick={nextStep}
									class="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-all hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/30 active:scale-95"
								>
									Siguiente
									<ChevronRightIcon class="size-4" />
								</button>
							{:else}
								<button
									type="button"
									onclick={handleSubmit}
									disabled={submitting}
									class="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 active:scale-95 disabled:opacity-60"
								>
									{#if submitting}
										<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
										Enviando...
									{:else}
										<CheckIcon class="size-4" />
										Enviar pre-inscripción
									{/if}
								</button>
							{/if}
						</div>
					{/if}
				</form>

				<p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
					Sistema de Gestión Académica y Financiera · © {new Date().getFullYear()} Unidad de Postgrado · UAGRM
				</p>
			{/if}
		</div>
	</div>
</div>
