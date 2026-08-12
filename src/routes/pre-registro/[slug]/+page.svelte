<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { getPublicForm, submitPublicForm, uploadCartaFirmada } from '$lib/services/pre-registration.service';
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
	import { fly, fade, slide, scale } from 'svelte/transition';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';

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

	// F-2026-08-11-CAMPOS-EC: campos opcionales del Diplomado Gestión Tributaria
	// y demás programas de educación continua (planilla de Lisa). Si el
	// estudiante NO se inscribe a un diplomado EC, simplemente los deja vacíos.
	let registroUniversitario = $state('');
	let avanceAcademicoCodigo = $state('');
	let formularioDescuentoNumero = $state('');
	let carreraCodigo = $state('');
	let descuentoPorcentaje = $state(''); // en %, se convierte a 0-1 al enviar

	// F-2026-08-11-CAMPOS-EC-MODALIDAD: campos adicionales requeridos por
	// la reunión UAGRM 2026-08-11 (sección 4: presencial vs virtual).
	// - procedencia: departamento de Bolivia (SCZ, LPZ, CBA, TJA, CHS, POT, BEN, ORU, PND).
	//   Distinto de `departamento` que es texto libre: este es codigo oficial.
	// - modalidad: presencial o virtual. Si el estudiante es de PROVINCIA
	//   o elige VIRTUAL, debe subir la carta firmada por el director.
	// - carta_firmada_url: URL/identificador del documento firmado. Validamos
	//   que no este vacio cuando aplica la regla.
	let procedencia = $state('');
	let modalidad = $state<'' | 'presencial' | 'virtual'>('');

	// F-2026-08-11-CAMPOS-EC-MODALIDAD-FILE (Kevin 22:17): cambio de input
	// type="url" a type="file" para subir la carta directamente. La URL
	// devuelta por Cloudinary (post-upload) se guarda en cartaFirmadaUrl.
	let cartaFirmadaUrl = $state('');
	let cartaFirmadaNombre = $state(''); // nombre del archivo para mostrar al usuario
	let cartaFirmadaSubiendo = $state(false);
	let cartaFirmadaError = $state('');

	let fieldErrors = $state<Record<string, string>>({});

	// Wizard state
	const STEPS = [
		{ id: 1, title: 'Identidad', subtitle: '¿Quién eres?', icon: UserIcon, fields: ['nombre', 'email', 'carnet', 'extension'] },
		{ id: 2, title: 'Contacto', subtitle: '¿Cómo te ubicamos?', icon: IdentificationIcon, fields: ['celular', 'fechaNacimiento', 'sexo', 'domicilio'] },
		{ id: 3, title: 'Datos EC', subtitle: 'Educación continua (opcional)', icon: IdentificationIcon, fields: ['registroUniversitario', 'avanceAcademicoCodigo', 'formularioDescuentoNumero', 'carreraCodigo', 'descuentoPorcentaje', 'procedencia', 'modalidad', 'cartaFirmadaUrl'] },
		{ id: 4, title: 'Confirmar', subtitle: 'Revisa y envía', icon: CircleCheckIcon, fields: ['mensaje'] }
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
			form = await getPublicForm(slug || '');
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
			const data = { nombre, email, carnet, extension, celular, fechaNacimiento, sexo, domicilio, mensaje, registroUniversitario, avanceAcademicoCodigo, formularioDescuentoNumero, carreraCodigo, descuentoPorcentaje, procedencia, modalidad, cartaFirmadaUrl, cartaFirmadaNombre, currentStep, savedAt: Date.now() };
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
			registroUniversitario = data.registroUniversitario || '';
			avanceAcademicoCodigo = data.avanceAcademicoCodigo || '';
			formularioDescuentoNumero = data.formularioDescuentoNumero || '';
			carreraCodigo = data.carreraCodigo || '';
			descuentoPorcentaje = data.descuentoPorcentaje || '';
			procedencia = data.procedencia || '';
			modalidad = data.modalidad || '';
			cartaFirmadaUrl = data.cartaFirmadaUrl || '';
			cartaFirmadaNombre = data.cartaFirmadaNombre || '';
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
	// F-FIX-TRIM-NUMBER (2026-08-11): bug en consola "r(...).trim is not a function"
	// cuando el usuario tipeaba en el input de descuentoPorcentaje. Causa raiz:
	// bind:value en <input type="number"> coerce el state a `number | null`,
	// y Number.prototype no tiene .trim(). Fix: usar String(v ?? '').trim() en
	// TODOS los cases (defense in depth, no solo en el que falla).
	function validateField(key: string): string | null {
		const raw = (() => {
			switch (key) {
				case 'nombre': return nombre;
				case 'email': return email;
				case 'carnet': return carnet;
				case 'extension': return extension;
				case 'celular': return celular;
				case 'fechaNacimiento': return fechaNacimiento;
				case 'domicilio': return domicilio;
				case 'mensaje': return mensaje;
				case 'registroUniversitario': return registroUniversitario;
				case 'avanceAcademicoCodigo': return avanceAcademicoCodigo;
				case 'formularioDescuentoNumero': return formularioDescuentoNumero;
				case 'carreraCodigo': return carreraCodigo;
				case 'descuentoPorcentaje': return descuentoPorcentaje;
				case 'procedencia': return procedencia;
				case 'modalidad': return modalidad;
				case 'cartaFirmadaUrl': return cartaFirmadaUrl;
				default: return '';
			}
		})();
		const v = String(raw ?? '').trim();

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
		// F-2026-08-11-CAMPOS-EC: campos opcionales, validar formato solo si se lleno algo
		if (v && key === 'avanceAcademicoCodigo' && !/^\d+$/.test(v)) {
			return 'Solo dígitos (código numérico).';
		}
		if (v && key === 'formularioDescuentoNumero' && !/^\d+$/.test(v)) {
			return 'Solo dígitos (número de formulario).';
		}
		if (v && key === 'descuentoPorcentaje') {
			const n = Number(v);
			if (Number.isNaN(n) || n < 0 || n > 100) {
				return 'Debe ser un número entre 0 y 100 (porcentaje).';
			}
		}
		// F-2026-08-11-CAMPOS-EC-MODALIDAD: la carta firmada es OBLIGATORIA
		// si el estudiante es de PROVINCIA (procedencia != SCZ) o si eligió
		// modalidad virtual. Decision reunion UAGRM 2026-08-11.
		if (key === 'cartaFirmadaUrl' && !v) {
			const prov = String(procedencia ?? '').trim().toUpperCase();
			const mod = String(modalidad ?? '').trim();
			if (mod === 'virtual' || (prov && prov !== 'SCZ')) {
				return 'La carta firmada por el director es obligatoria para estudiantes de provincia o modalidad virtual.';
			}
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
			const result = await submitPublicForm(slug || '', {
				nombre: nombre.trim(),
				email: email.trim().toLowerCase(),
				carnet: carnet.trim(),
				extension: extension.trim() || undefined,
				celular: celular.trim(),
				fecha_nacimiento: fechaNacimiento.trim() || undefined,
				sexo: (sexo || undefined) as 'masculino' | 'femenino' | undefined,
				domicilio: domicilio.trim() || undefined,
				mensaje: mensaje.trim() || undefined,
				// F-2026-08-11-CAMPOS-EC: solo enviar si tienen contenido
				registro_universitario: String(registroUniversitario ?? '').trim() || undefined,
				avance_academico_codigo: String(avanceAcademicoCodigo ?? '').trim() ? Number(String(avanceAcademicoCodigo ?? '').trim()) : undefined,
				formulario_descuento_numero: String(formularioDescuentoNumero ?? '').trim() ? Number(String(formularioDescuentoNumero ?? '').trim()) : undefined,
				carrera_codigo: String(carreraCodigo ?? '').trim() || undefined,
				descuento_porcentaje: String(descuentoPorcentaje ?? '').trim() ? Number(String(descuentoPorcentaje ?? '').trim()) / 100 : undefined,
				// F-2026-08-11-CAMPOS-EC-MODALIDAD: procedencia/modalidad/carta
				procedencia: String(procedencia ?? '').trim() || undefined,
				modalidad: String(modalidad ?? '').trim() || undefined,
				carta_firmada_url: String(cartaFirmadaUrl ?? '').trim() || undefined
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

	// F-2026-08-11-CAMPOS-EC-MODALIDAD-FILE (Kevin 22:17): handlers para
	// subir y quitar la carta firmada via input file.
	async function handleCartaSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validacion local basica (la validacion final la hace el backend)
		const MAX_SIZE = 20 * 1024 * 1024; // 20MB
		if (file.size > MAX_SIZE) {
			cartaFirmadaError = 'El archivo es demasiado grande (maximo 20MB).';
			input.value = '';
			return;
		}
		const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
		if (!allowed.includes(file.type)) {
			cartaFirmadaError = 'Tipo de archivo no permitido. Usa PDF, JPG o PNG.';
			input.value = '';
			return;
		}

		cartaFirmadaError = '';
		cartaFirmadaSubiendo = true;
		try {
			const result = await uploadCartaFirmada(slug || '', file);
			cartaFirmadaUrl = result.url;
			cartaFirmadaNombre = file.name;
			clearError('cartaFirmadaUrl');
			saveAutosave();
		} catch (e: any) {
			cartaFirmadaError = e?.message || 'No se pudo subir el archivo. Intentalo de nuevo.';
			cartaFirmadaUrl = '';
			cartaFirmadaNombre = '';
		} finally {
			cartaFirmadaSubiendo = false;
			input.value = ''; // reset para permitir resubir el mismo archivo
		}
	}

	function removeCarta() {
		cartaFirmadaUrl = '';
		cartaFirmadaNombre = '';
		cartaFirmadaError = '';
		clearError('cartaFirmadaUrl');
		saveAutosave();
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
										class="group flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 rounded-xl px-1.5 py-2 sm:px-2 text-left transition-all
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
											<span class="block truncate text-[10px] font-semibold sm:text-xs
												{isActive ? 'text-primary-700 dark:text-dark-tertiary' : isComplete ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}">
												{step.title}
											</span>
											<span class="hidden truncate text-[10px] text-gray-400 sm:block dark:text-gray-500">
												{step.subtitle}
											</span>
										</span>
									</button>
									{#if !isLast}
										<div class="h-0.5 w-2 shrink-0 rounded-full transition-all sm:w-3
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

						<!-- ============== PASO 3: Datos EC (opcional) ==============
						     F-2026-08-11-CAMPOS-EC: campos del Diplomado Gestión Tributaria y demás
						     programas de educación continua (planilla de Lisa). Si NO es EC, dejar vacíos. -->
						{#if currentStep === 3}
						<div in:fly={{ x: 20, duration: 350, easing: cubicOut }} out:fly={{ x: -20, duration: 200, easing: cubicOut }}>
							<div class="rounded-xl border border-primary-200 bg-primary-50/50 p-3 dark:border-primary-900/50 dark:bg-primary-900/10">
								<p class="text-xs text-primary-800 dark:text-dark-tertiary">
									<strong>¿Te inscribes a un diplomado de educación continua?</strong> Si es así, completa estos datos. Si no, déjalos vacíos y continúa.
								</p>
							</div>

							<!-- Registro Universitario -->
							<div>
								<label for="pr-registro" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Registro Universitario <span class="text-xs font-normal text-gray-400">(opcional)</span>
								</label>
								<input
									id="pr-registro"
									type="text"
									bind:value={registroUniversitario}
									oninput={() => { clearError('registroUniversitario'); saveAutosave(); }}
									class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
									placeholder="Ej: 219012345"
									maxlength="30"
									disabled={isExpired}
									aria-invalid={!!fieldErrors.registroUniversitario}
									aria-describedby={fieldErrors.registroUniversitario ? 'pr-registro-error' : undefined}
								/>
								{#if fieldErrors.registroUniversitario}
									<p id="pr-registro-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.registroUniversitario}</p>
								{:else}
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Si ya eres egresado de la UAGRM, ingresa tu número de registro</p>
								{/if}
							</div>

							<!-- Avance Académico (código) + Formulario de Descuento (número) -->
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label for="pr-avance" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Código de avance académico <span class="text-xs font-normal text-gray-400">(opcional)</span>
									</label>
									<input
										id="pr-avance"
										type="text"
										inputmode="numeric"
										bind:value={avanceAcademicoCodigo}
										oninput={() => { clearError('avanceAcademicoCodigo'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.avanceAcademicoCodigo ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										placeholder="Solo dígitos"
										disabled={isExpired}
										aria-invalid={!!fieldErrors.avanceAcademicoCodigo}
										aria-describedby={fieldErrors.avanceAcademicoCodigo ? 'pr-avance-error' : undefined}
									/>
									{#if fieldErrors.avanceAcademicoCodigo}
										<p id="pr-avance-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.avanceAcademicoCodigo}</p>
									{/if}
								</div>
								<div>
									<label for="pr-formdesc" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Nº de Formulario de Descuento <span class="text-xs font-normal text-gray-400">(opcional)</span>
									</label>
									<input
										id="pr-formdesc"
										type="text"
										inputmode="numeric"
										bind:value={formularioDescuentoNumero}
										oninput={() => { clearError('formularioDescuentoNumero'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.formularioDescuentoNumero ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										placeholder="Solo dígitos"
										disabled={isExpired}
										aria-invalid={!!fieldErrors.formularioDescuentoNumero}
										aria-describedby={fieldErrors.formularioDescuentoNumero ? 'pr-formdesc-error' : undefined}
									/>
									{#if fieldErrors.formularioDescuentoNumero}
										<p id="pr-formdesc-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.formularioDescuentoNumero}</p>
									{/if}
								</div>
							</div>

							<!-- Carrera (código) + Descuento (%) -->
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label for="pr-carrera" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Código de carrera <span class="text-xs font-normal text-gray-400">(opcional)</span>
									</label>
									<input
										id="pr-carrera"
										type="text"
										bind:value={carreraCodigo}
										oninput={() => { clearError('carreraCodigo'); saveAutosave(); }}
										class="w-full rounded-xl border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
										placeholder="Ej: CONT-2024"
										maxlength="20"
										disabled={isExpired}
										aria-invalid={!!fieldErrors.carreraCodigo}
									/>
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Si vienes de otra carrera, indica el código</p>
								</div>
								<div>
									<label for="pr-descuento" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Descuento <span class="text-xs font-normal text-gray-400">(opcional, 0-100%)</span>
									</label>
									<!-- F-FIX-TRIM-NUMBER (2026-08-11): type="text" + inputmode="decimal"
									     para que el state SIEMPRE sea string. type="number" coerce a
									     number|null y rompia .trim() en validacion. UX equivalente
									     en mobile (teclado numerico via inputmode). -->
									<input
										id="pr-descuento"
										type="text"
										inputmode="decimal"
										bind:value={descuentoPorcentaje}
										oninput={() => { clearError('descuentoPorcentaje'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.descuentoPorcentaje ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										placeholder="Ej: 50"
										disabled={isExpired}
										aria-invalid={!!fieldErrors.descuentoPorcentaje}
										aria-describedby={fieldErrors.descuentoPorcentaje ? 'pr-descuento-error' : undefined}
									/>
									{#if fieldErrors.descuentoPorcentaje}
										<p id="pr-descuento-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.descuentoPorcentaje}</p>
									{:else}
										<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Aplica a módulos, no a matrícula</p>
									{/if}
								</div>
							</div>

							<!-- F-2026-08-11-CAMPOS-EC-MODALIDAD (reunion UAGRM 2026-08-11):
							     Procedencia + Modalidad + Carta firmada por el director.
							     Si el estudiante es de PROVINCIA (procedencia != SCZ) o elige
							     modalidad VIRTUAL, debe subir carta firmada (decision reunion). -->

							<!-- Procedencia (codigo departamento Bolivia) + Modalidad (presencial/virtual) -->
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label for="pr-procedencia" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Procedencia <span class="text-xs font-normal text-gray-400">(opcional)</span>
									</label>
									<select
										id="pr-procedencia"
										bind:value={procedencia}
										onchange={() => { clearError('procedencia'); clearError('cartaFirmadaUrl'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.procedencia ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										disabled={isExpired}
									>
										<option value="">— Selecciona tu departamento —</option>
										<option value="SCZ">Santa Cruz (SCZ)</option>
										<option value="LPZ">La Paz (LPZ)</option>
										<option value="CBA">Cochabamba (CBA)</option>
										<option value="TJA">Tarija (TJA)</option>
										<option value="CHS">Chuquisaca (CHS)</option>
										<option value="POT">Potosí (POT)</option>
										<option value="ORU">Oruro (ORU)</option>
										<option value="BEN">Beni (BEN)</option>
										<option value="PND">Pando (PND)</option>
									</select>
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Si no eres de Santa Cruz, se requerirá carta firmada</p>
								</div>
								<div>
									<label for="pr-modalidad" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										Modalidad <span class="text-xs font-normal text-gray-400">(opcional)</span>
									</label>
									<select
										id="pr-modalidad"
										bind:value={modalidad}
										onchange={() => { clearError('modalidad'); clearError('cartaFirmadaUrl'); saveAutosave(); }}
										class="w-full rounded-xl border-2 bg-white dark:bg-dark-surface py-3 px-3 text-base text-gray-900 dark:text-white outline-none transition-all
											{fieldErrors.modalidad ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}"
										disabled={isExpired}
									>
										<option value="">— Selecciona —</option>
										<option value="presencial">Presencial</option>
										<option value="virtual">Virtual</option>
									</select>
									<p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Si elegís virtual, se requerirá carta firmada</p>
								</div>
							</div>

							<!-- Carta firmada por el director (file upload directo a Cloudinary) -->
							<div>
								<label for="pr-carta" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									Carta firmada por el director
									{#if procedencia && procedencia !== 'SCZ'}
										<span class="text-red-500">*</span>
									{:else if modalidad === 'virtual'}
										<span class="text-red-500">*</span>
									{:else}
										<span class="text-xs font-normal text-gray-400">(opcional)</span>
									{/if}
								</label>

								<!-- F-2026-08-11-CAMPOS-EC-MODALIDAD-FILE: input file en vez de URL.
								     El usuario elige el archivo de su maquina, se sube automaticamente
								     a Cloudinary y la URL resultante se guarda en cartaFirmadaUrl. -->

								{#if cartaFirmadaUrl}
									<!-- Preview del archivo ya subido -->
									<div class="flex items-center gap-3 rounded-xl border-2 border-green-300 bg-green-50/50 p-3 dark:border-green-800/60 dark:bg-green-900/20">
										<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
											<CheckIcon class="size-5 text-green-600 dark:text-green-400" />
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{cartaFirmadaNombre || 'Carta firmada.pdf'}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{cartaFirmadaUrl}</p>
										</div>
										<button
											type="button"
											onclick={removeCarta}
											disabled={isExpired}
											class="shrink-0 rounded-lg p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95 dark:hover:bg-red-900/30"
											aria-label="Quitar carta firmada"
										>
											<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{:else}
									<!-- Input file con preview del nombre antes de subir -->
									<label
										class="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed bg-white dark:bg-dark-surface py-3 px-3 text-base transition-all
											{fieldErrors.cartaFirmadaUrl ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-300 dark:border-dark-border hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10'}
											{isExpired ? 'cursor-not-allowed opacity-60' : ''}"
									>
										<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40">
											{#if cartaFirmadaSubiendo}
												<div class="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600"></div>
											{:else}
												<svg class="size-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
													<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
												</svg>
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-semibold text-gray-900 dark:text-white">
												{cartaFirmadaSubiendo ? 'Subiendo...' : 'Subir archivo (PDF, JPG, PNG)'}
											</p>
											<p class="truncate text-xs text-gray-500 dark:text-gray-400">
												{cartaFirmadaSubiendo
													? 'Por favor espera unos segundos'
													: 'Hacé click para elegir el archivo de tu maquina (max 20MB)'}
											</p>
										</div>
										<input
											id="pr-carta"
											type="file"
											accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
											onchange={handleCartaSelected}
											disabled={isExpired || cartaFirmadaSubiendo}
											class="sr-only"
											aria-invalid={!!fieldErrors.cartaFirmadaUrl}
											aria-describedby={fieldErrors.cartaFirmadaUrl ? 'pr-carta-error' : 'pr-carta-help'}
										/>
									</label>
								{/if}

								{#if cartaFirmadaError}
									<p class="mt-1 text-xs font-medium text-red-600">{cartaFirmadaError}</p>
								{:else if fieldErrors.cartaFirmadaUrl}
									<p id="pr-carta-error" class="mt-1 text-xs font-medium text-red-600">{fieldErrors.cartaFirmadaUrl}</p>
								{:else}
									<p id="pr-carta-help" class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
										Requerida si sos de provincia o elegiste modalidad virtual. Podes subir un PDF, JPG o PNG de hasta 20MB.
									</p>
								{/if}
							</div>
						</div>
						{/if}

						<!-- ============== PASO 4: Confirmar ============== -->
						{#if currentStep === 4}
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

							<!-- F-2026-08-11-CAMPOS-EC: resumen de datos EC (solo si alguno está lleno) -->
							{#if registroUniversitario || avanceAcademicoCodigo || formularioDescuentoNumero || carreraCodigo || descuentoPorcentaje || procedencia || modalidad || cartaFirmadaUrl}
								<div class="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/10">
									<h3 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
										<IdentificationIcon class="size-4" />
										Datos de educación continua
									</h3>
									<dl class="space-y-2 text-sm">
										{#if registroUniversitario}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Registro Univ.</dt>
												<dd class="font-mono text-gray-900 dark:text-white text-right">{registroUniversitario}</dd>
											</div>
										{/if}
										{#if avanceAcademicoCodigo}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Avance académico</dt>
												<dd class="font-mono text-gray-900 dark:text-white text-right">{avanceAcademicoCodigo}</dd>
											</div>
										{/if}
										{#if formularioDescuentoNumero}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Nº Form. Descuento</dt>
												<dd class="font-mono text-gray-900 dark:text-white text-right">{formularioDescuentoNumero}</dd>
											</div>
										{/if}
										{#if carreraCodigo}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Carrera</dt>
												<dd class="font-mono text-gray-900 dark:text-white text-right">{carreraCodigo}</dd>
											</div>
										{/if}
										{#if descuentoPorcentaje}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Descuento</dt>
												<dd class="font-semibold text-gray-900 dark:text-white text-right">{descuentoPorcentaje}%</dd>
											</div>
										{/if}
										{#if procedencia}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Procedencia</dt>
												<dd class="font-mono text-gray-900 dark:text-white text-right">{procedencia}</dd>
											</div>
										{/if}
										{#if modalidad}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Modalidad</dt>
												<dd class="font-semibold text-gray-900 dark:text-white text-right capitalize">{modalidad}</dd>
											</div>
										{/if}
										{#if cartaFirmadaUrl}
											<div class="flex justify-between gap-3">
												<dt class="text-gray-500 dark:text-gray-400">Carta firmada</dt>
												<dd class="font-mono text-xs text-gray-900 dark:text-white text-right break-all max-w-[60%]">{cartaFirmadaUrl}</dd>
											</div>
										{/if}
									</dl>
								</div>
							{/if}

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
