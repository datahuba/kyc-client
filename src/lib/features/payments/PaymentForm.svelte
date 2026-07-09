<script lang="ts">
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/stores';
	import { enrollmentService, paymentService, paymentConfigService, courseService } from '$lib/services';
	import type { Student, Enrollment, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { alert } from '$lib/utils';
	import { UploadIcon, CheckIcon } from '$lib/icons/outline';
	import { CircleCheckIcon } from '$lib/icons/outline';
	import { ExclamationCircleIcon } from '$lib/icons/solid';

	interface Props {
		onSuccess: () => void;
		onCancel: () => void;
		// Atajo directo desde "Ver Libreta -> Pagar Saldo Pendiente": si se
		// provee, preselecciona esa inscripción sin que el estudiante tenga
		// que volver a buscarla en el selector.
		preselectedEnrollmentId?: string;
	}

	let { onSuccess, onCancel, preselectedEnrollmentId }: Props = $props();

	let enrollments: Enrollment[] = $state([]);
	let coursesList: Course[] = $state([]);
	let loading = $state(true);
	let saving = $state(false);

	let selectedEnrollmentId = $state('');
	let transactionNumber = $state('');
	let file: File | null = $state(null);
	let qrUrl = $state('');

	// --- ESTADOS DE PAGO ---
	let concepto = $state('');
	let metodoPago = $state('Transferencia'); // 'Transferencia', 'Depósito', 'Caja'
	let remitente = $state('');
	let banco = $state('');
	let montoComprobante = $state<number | null>(null);
	let fechaComprobante = $state(new Date().toISOString().split('T')[0]);
	let cuentaDestino = $state('');

	// ISSUE-P-CUENTA-UNICA (2026-07-09): la cuenta destino ya NO es un
	// desplegable de cuentas hardcodeadas. Es la ÚNICA cuenta institucional
	// configurada por superadmin/admin desde /app/payment-config (Banco Unión
	// de la unidad). Se muestra fija (solo lectura) y se autocompleta.
	let cuentaInstitucional = $state<{ numero_cuenta?: string; banco?: string; titular?: string; tipo_cuenta?: string } | null>(null);

	// Seguro para evitar auto-relleno infinito (UX FIX)
	let lastAutoFilledId = $state('');

	const metodosDisponibles = ['Transferencia', 'Depósito', 'Caja'];
	const bancosDisponibles = [
		'Banco Unión',
		'BNB',
		'Mercantil Santa Cruz',
		'Banco Bisa',
		'Banco Ganadero',
		'Banco Económico',
		'Yape',
		'Altoke',
		'Yolo',
		'Otro'
	];


	let isMatriculaPagada = $derived(
		selectedEnrollmentId
			? !!enrollments.find((e) => e._id === selectedEnrollmentId)?.matricula_pagada
			: false
	);

	let requiereBancoYVoucher = $derived(metodoPago !== 'Caja');

	onMount(async () => {
		// BUG CORREGIDO: antes se usaba Promise.all() para las 3 cargas. Si la
		// configuración de pago (QR/cuenta) no existía todavía (404, caso real
		// en producción: la colección payment_config estaba vacía), TODO el
		// bloque fallaba y las inscripciones nunca se cargaban -- el select
		// de "Inscripción / Programa" quedaba vacío sin ningún error visible
		// para el estudiante. Ahora cada carga es independiente: si el QR no
		// existe, simplemente no se muestra esa sección, pero cursos e
		// inscripciones cargan igual.
		const resultados = await Promise.allSettled([
			paymentConfigService.get(),
			courseService.getAll(1, 100),
			$userStore.user?._id ? enrollmentService.getByStudentId($userStore.user._id) : Promise.resolve([])
		]);

		const [configResult, coursesResult, enrollmentsResult] = resultados;

		if (configResult.status === 'fulfilled' && configResult.value) {
			if (configResult.value.qr_url) qrUrl = configResult.value.qr_url;
			// ISSUE-P-CUENTA-UNICA: capturar la cuenta institucional configurada
			// y autocompletar cuentaDestino (cuenta única, no desplegable).
			cuentaInstitucional = {
				numero_cuenta: configResult.value.numero_cuenta,
				banco: configResult.value.banco,
				titular: configResult.value.titular,
				tipo_cuenta: configResult.value.tipo_cuenta
			};
			if (configResult.value.numero_cuenta) {
				cuentaDestino = `${configResult.value.banco ? configResult.value.banco + ' - ' : ''}${configResult.value.numero_cuenta}`;
			}
		}
		// Si config falla (ej. 404 porque aún no se configuró el QR/cuenta), no es un
		// error bloqueante -- simplemente no se muestra el QR informativo.

		if (coursesResult.status === 'fulfilled' && coursesResult.value?.data) {
			coursesList = coursesResult.value.data;
		} else if (coursesResult.status === 'rejected') {
			console.error('Error al cargar cursos', coursesResult.reason);
			alert('error', 'No se pudieron cargar los cursos. Recarga la página.');
		}

		if (enrollmentsResult.status === 'fulfilled') {
			enrollments = enrollmentsResult.value;
		} else if (enrollmentsResult.status === 'rejected') {
			console.error('Error al cargar inscripciones', enrollmentsResult.reason);
			alert('error', 'No se pudieron cargar tus inscripciones. Recarga la página.');
		}

		// Preselección directa desde "Ver Libreta -> Pagar Saldo Pendiente"
		// (evita que el estudiante tenga que volver a buscar/seleccionar su
		// propio curso e inscripción manualmente).
		if (preselectedEnrollmentId && enrollments.some((e) => e._id === preselectedEnrollmentId)) {
			selectedEnrollmentId = preselectedEnrollmentId;
		}

		loading = false;
	});

	$effect(() => {
		if (!selectedEnrollmentId) {
			montoComprobante = null;
			concepto = '';
			lastAutoFilledId = '';
			return;
		}

		const enrollment = enrollments.find((e) => e._id === selectedEnrollmentId);
		if (!enrollment) return;

		const course = coursesList.find((c) => c._id === enrollment.curso_id);
		if (!course) return;

		// ISSUE-P-PRECIO-UNICO (2026-07-08): el precio del programa es el
		// mismo para todos los estudiantes, ya no distingue interno/externo.
		if (!isMatriculaPagada) {
			concepto = 'Matrícula';
			// Solo auto-sugiere si el usuario recién seleccionó este curso
			if (lastAutoFilledId !== selectedEnrollmentId) {
				montoComprobante = course.matricula_interno;
				lastAutoFilledId = selectedEnrollmentId;
			}
		} else {
			concepto = 'Módulo';
			// Solo auto-sugiere si el usuario recién seleccionó este curso
			if (lastAutoFilledId !== selectedEnrollmentId) {
				const total = course.costo_total_interno;
				const cuotas = course.cantidad_cuotas || 1;
				montoComprobante = Math.round((total / cuotas) * 100) / 100;
				lastAutoFilledId = selectedEnrollmentId;
			}
		}
	});

	$effect(() => {
		if (transactionNumber) {
			const sanitized = transactionNumber.replace(/[^0-9]/g, '');
			if (sanitized !== transactionNumber) {
				transactionNumber = sanitized;
			}
		}
	});

	async function handleSubmit() {
		// AUDITORÍA: guard explícito contra doble submit (doble click/doble
		// Enter antes de que `saving=true` bloquee el botón visualmente).
		if (saving) return;

		if (!selectedEnrollmentId || montoComprobante === null || !concepto || !metodoPago) {
			alert('error', 'Por favor complete todos los campos obligatorios del pago.');
			return;
		}

		if (montoComprobante <= 0) {
			alert('error', 'El monto a reportar debe ser mayor a 0 Bs.');
			return;
		}

		if (requiereBancoYVoucher) {
			if (!transactionNumber || !file || !banco || !remitente || !cuentaDestino || !fechaComprobante) {
				alert('error', 'Debe adjuntar el voucher, el banco y el número de transacción para pagos digitales.');
				return;
			}
			const regexSoloNumeros = /^[0-9]+$/;
			if (!regexSoloNumeros.test(transactionNumber)) {
				alert('error', 'El número de transacción solo debe contener números.');
				return;
			}
		}

		saving = true;
		try {
			const payload: any = {
				inscripcion_id: selectedEnrollmentId,
				metodo_pago: metodoPago,
				concepto,
				cantidad_pago: montoComprobante,
				monto_comprobante: montoComprobante
			};

			if (requiereBancoYVoucher) {
				payload.numero_transaccion = transactionNumber;
				payload.file = file;
				payload.remitente = remitente;
				payload.banco = banco;
				payload.fecha_comprobante = fechaComprobante;
				payload.cuenta_destino = cuentaDestino;
			} else {
				payload.numero_transaccion = `CAJA-${Date.now()}`;
				payload.remitente = $userStore.user?.nombre || 'Caja Física';
				payload.banco = 'Caja UAGRM';
				payload.fecha_comprobante = new Date().toISOString().split('T')[0];
				payload.cuenta_destino = 'Caja Central';
			}

			await paymentService.create(payload);

			// [SANEADO LOGICO - TEXTO DINÁMICO REVISOR]
			// Determinamos si audita el CPD (para Matrícula) o Cobranzas (para Módulos de colegiatura)
			const conceptoLower = (concepto || '').toLowerCase().trim();
			const isMatricula = conceptoLower.includes('matricula') || conceptoLower.includes('matrícula');
			const revisor = isMatricula ? 'El CPD' : 'Cobranzas';

			alert('success', `Pago reportado correctamente. ${revisor} lo revisará a la brevedad.`);
			onSuccess();
		} catch (error: any) {
			console.error(error);
			alert('error', error.message || 'Error al registrar pago');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#if loading}
			<div>
				<span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>Inscripción / Programa</span
				>
				<div class="h-10 w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-700"></div>
			</div>
		{:else}
			<Select label="Inscripción / Programa" id="enrollment" bind:value={selectedEnrollmentId} required>
				<option value="">Seleccione una inscripción</option>
				{#each enrollments as enrollment}
					<option value={enrollment._id}>
						{coursesList.find((c) => c._id === enrollment.curso_id)?.codigo || 'Prog'} - Saldo: {enrollment.saldo_pendiente}
						Bs.
					</option>
				{/each}
			</Select>
		{/if}

		<div>
			<Input
				label="Concepto de Pago"
				id="concepto"
				value={concepto}
				readonly
				placeholder="Seleccione un programa primero"
				class="bg-gray-100 font-semibold tracking-wider text-gray-500 uppercase dark:bg-gray-800 dark:text-gray-400"
			/>
			{#if selectedEnrollmentId && !isMatriculaPagada}
				<p class="mt-1 flex items-center gap-1 text-xs font-bold text-light-warning dark:text-dark-warning">
					<ExclamationCircleIcon class="size-3.5 shrink-0" />
					Debes pagar la Matrícula institucional antes de habilitar las cuotas de colegiatura.
				</p>
			{:else if selectedEnrollmentId && isMatriculaPagada}
				<p class="mt-1 flex items-center gap-1 text-xs font-bold text-light-success dark:text-dark-success">
					<CircleCheckIcon className="size-3.5 shrink-0" />
					Matrícula al día. Puedes registrar pagos de colegiatura.
				</p>
			{/if}
		</div>
	</div>

	<div class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
		<div class="mb-2 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
			<h3 class="text-sm font-bold tracking-wider text-gray-800 uppercase dark:text-gray-200">
				Detalles de la Transacción
			</h3>
			<div class="w-40">
				<Select label="Método" id="metodoPago" bind:value={metodoPago}>
					{#each metodosDisponibles as m}
						<option value={m}>{m}</option>
					{/each}
				</Select>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#if requiereBancoYVoucher}
				<Input
					label="Nombre del Remitente"
					id="remitente"
					bind:value={remitente}
					required={requiereBancoYVoucher}
					placeholder="Como figura en el voucher"
				/>

				<Select label="Banco Origen" id="banco" bind:value={banco} required={requiereBancoYVoucher}>
					<option value="">Seleccione Banco</option>
					{#each bancosDisponibles as b}
						<option value={b}>{b}</option>
					{/each}
				</Select>
			{/if}

			<div class="space-y-1 {requiereBancoYVoucher ? '' : 'max-w-sm md:col-span-2'}">
				<Input
					label="Monto Pagado (Bs)"
					id="montoComprobante"
					type="number"
					step="0.01"
					min="1"
					bind:value={montoComprobante}
					required
					disabled={!selectedEnrollmentId}
					class="text-lg font-bold text-primary-600 disabled:opacity-50"
					placeholder="Ej: 588.00"
				/>
				{#if selectedEnrollmentId}
					<p class="text-xs leading-tight font-medium text-uagrm-sky">
						Se sugiere este monto, pero puedes modificarlo si pagaste una cantidad diferente. El
						sistema distribuirá tu saldo en cascada.
					</p>
				{/if}
			</div>

			{#if requiereBancoYVoucher}
				<Input
					label="Fecha del Voucher"
					id="fechaComprobante"
					type="date"
					bind:value={fechaComprobante}
					required
				/>

				<!-- ISSUE-P-CUENTA-UNICA: cuenta institucional única (Banco Unión de
				     la unidad), configurable solo por superadmin/admin desde
				     /app/payment-config. Se muestra fija, no como desplegable. -->
				<div class="md:col-span-2">
					<p class="mb-1.5 block text-sm font-medium text-light-black dark:text-dark-white">
						Cuenta Destino (Nuestra Institución)
					</p>
					{#if cuentaInstitucional?.numero_cuenta}
						<div class="rounded-lg border border-light-four bg-light-primary/40 p-3 dark:border-dark-border dark:bg-dark-background/40">
							<p class="text-base font-bold text-light-black dark:text-dark-white">
								{cuentaInstitucional.banco || 'Banco'} — {cuentaInstitucional.numero_cuenta}
							</p>
							{#if cuentaInstitucional.titular || cuentaInstitucional.tipo_cuenta}
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{cuentaInstitucional.titular || ''}{cuentaInstitucional.titular && cuentaInstitucional.tipo_cuenta ? ' · ' : ''}{cuentaInstitucional.tipo_cuenta || ''}
								</p>
							{/if}
							<p class="mt-1 text-xs text-uagrm-sky">Realiza tu pago a esta cuenta.</p>
						</div>
					{:else}
						<div class="rounded-lg border border-light-warning/40 bg-light-warning/10 p-3 dark:border-dark-warning/40 dark:bg-dark-warning/10">
							<p class="text-sm text-light-warning dark:text-dark-warning">
								La cuenta institucional aún no ha sido configurada. Contacta a administración.
							</p>
						</div>
					{/if}
				</div>

				<div class="md:col-span-2">
					<div class="space-y-1">
						<Input
							label="Número de Transacción / Referencia"
							id="transactionNumber"
							bind:value={transactionNumber}
							required
							placeholder="Ej: 84729384"
							class="font-mono text-lg tracking-widest"
						/>
						<p class="text-xs font-medium text-uagrm-sky">
							Sólo ingresa los números principales del recibo bancario.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if requiereBancoYVoucher}
		<div class="animate-fade-in flex flex-col gap-6 lg:flex-row">
			{#if qrUrl}
				<div
					class="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-4 dark:bg-gray-800"
				>
					<span class="mb-2 text-xs font-bold text-gray-500 uppercase">Pagar vía QR</span>
					<img src={qrUrl} alt="QR" class="h-40 w-40 object-contain" />
				</div>
			{/if}

			<div class="flex-[2] space-y-1">
				<label for="comprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					Archivo del Comprobante
				</label>
				<FileUpload
					id="comprobante"
					accept="image/*,application/pdf"
					{file}
					onFileSelect={(f) => (file = f)}
					label="Subir Imagen o PDF"
				/>
			</div>
		</div>
	{/if}

	<div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel} disabled={saving}>Cancelar</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				{#if requiereBancoYVoucher}
					<UploadIcon class="size-5" />
				{:else}
					<CheckIcon class="size-5" />
				{/if}
			{/snippet}
			{requiereBancoYVoucher ? 'Subir Comprobante' : 'Registrar Pago en Caja'}
		</Button>
	</div>
</form>
