<script lang="ts">
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/stores';
	import { enrollmentService, paymentService, paymentConfigService, courseService } from '$lib/services';
	import type { Student, Enrollment, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { alert } from '$lib/utils';
	import { UploadIcon, CheckIcon } from '$lib/icons/outline';

	interface Props {
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { onSuccess, onCancel }: Props = $props();

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

	// Seguro para evitar auto-relleno infinito (UX FIX)
	let lastAutoFilledId = $state('');

    const metodosDisponibles = ["Transferencia", "Depósito", "Caja"];
    const bancosDisponibles = ["Banco Unión", "BNB", "Mercantil Santa Cruz", "Banco Bisa", "Banco Ganadero", "Banco Económico", "Yape", "Altoke", "Yolo", "Otro"];
    const cuentasInstitucion = ["Cta. Corriente BNB - 1234567", "Cta. Ahorros Unión - 9876543"];

	let isMatriculaPagada = $derived(
		selectedEnrollmentId 
			? !!enrollments.find(e => e._id === selectedEnrollmentId)?.matricula_pagada 
			: false
	);

	let requiereBancoYVoucher = $derived(metodoPago !== 'Caja');

	onMount(async () => {
		try {
			const [config, coursesRes] = await Promise.all([
				paymentConfigService.get(),
				courseService.getAll(1, 100)
			]);

			if (config && config.qr_url) {
				qrUrl = config.qr_url;
			}
			if (coursesRes && coursesRes.data) {
				coursesList = coursesRes.data;
			}
			
			if ($userStore.user?._id) {
				enrollments = await enrollmentService.getByStudentId($userStore.user._id);
			}
		} catch (error) {
			console.error(error);
			alert('error', 'Error al cargar inscripciones');
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		if (!selectedEnrollmentId) {
			montoComprobante = null;
			concepto = '';
			lastAutoFilledId = '';
			return;
		}

		const enrollment = enrollments.find(e => e._id === selectedEnrollmentId);
		if (!enrollment) return;

		const course = coursesList.find(c => c._id === enrollment.curso_id);
		if (!course) return;

		const isInterno = enrollment.es_estudiante_interno === 'interno';

		if (!isMatriculaPagada) {
			concepto = 'Matrícula';
			// Solo auto-sugiere si el usuario recién seleccionó este curso
			if (lastAutoFilledId !== selectedEnrollmentId) {
				montoComprobante = isInterno ? course.matricula_interno : course.matricula_externo;
				lastAutoFilledId = selectedEnrollmentId;
			}
		} else {
			concepto = 'Módulo';
			// Solo auto-sugiere si el usuario recién seleccionó este curso
			if (lastAutoFilledId !== selectedEnrollmentId) {
				const total = isInterno ? course.costo_total_interno : course.costo_total_externo;
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
				monto_comprobante: montoComprobante,
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
				payload.remitente = $userStore.user?.nombre || "Caja Física";
				payload.banco = "Caja UAGRM";
				payload.fecha_comprobante = new Date().toISOString().split('T')[0];
				payload.cuenta_destino = "Caja Central";
			}

			await paymentService.create(payload);

			// [SANEADO LOGICO - TEXTO DINÁMICO REVISOR]
			// Determinamos si audita el CPD (para Matrícula) o Cobranzas (para Módulos de colegiatura)
			const conceptoLower = (concepto || "").toLowerCase().trim();
			const isMatricula = conceptoLower.includes("matricula") || conceptoLower.includes("matrícula");
			const revisor = isMatricula ? "El CPD" : "Cobranzas";

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
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="enrollment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inscripción / Programa</label>
			{#if loading}
				<div class="h-10 w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-700"></div>
			{:else}
				<select
					id="enrollment"
					bind:value={selectedEnrollmentId}
					required
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
				>
					<option value="">Seleccione una inscripción</option>
					{#each enrollments as enrollment}
						<option value={enrollment._id}>
							{coursesList.find(c => c._id === enrollment.curso_id)?.codigo || 'Prog'} - Saldo: {enrollment.saldo_pendiente} Bs.
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<div>
			<label for="concepto" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto de Pago</label>
			<input
				id="concepto"
				type="text"
				value={concepto}
				readonly
				class="w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-gray-100 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider"
				placeholder="Seleccione un programa primero"
			/>
			{#if selectedEnrollmentId && !isMatriculaPagada}
				<p class="text-[10px] text-orange-600 font-bold mt-1">⚠️ Debes pagar la Matrícula institucional antes de habilitar las cuotas de colegiatura.</p>
			{:else if selectedEnrollmentId && isMatriculaPagada}
				<p class="text-[10px] text-green-600 font-bold mt-1">✅ Matrícula al día. Puedes registrar pagos de colegiatura.</p>
			{/if}
		</div>
	</div>

    <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
        
		<div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-2">
			<h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Detalles de la Transacción</h3>
			<div class="flex items-center gap-2">
				<label for="metodoPago" class="text-xs font-semibold text-gray-500 uppercase">Método:</label>
				<select bind:value={metodoPago} class="rounded-md border-gray-300 py-1 text-sm font-bold text-primary-600 dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:ring-primary-500">
					{#each metodosDisponibles as m} <option value={m}>{m}</option> {/each}
				</select>
			</div>
		</div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			
			{#if requiereBancoYVoucher}
				<Input label="Nombre del Remitente" bind:value={remitente} required={requiereBancoYVoucher} placeholder="Como figura en el voucher" />
				
				<div>
					<label for="banco" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco Origen</label>
					<select bind:value={banco} required={requiereBancoYVoucher} class="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
						<option value="">Seleccione Banco</option>
						{#each bancosDisponibles as b} <option value={b}>{b}</option> {/each}
					</select>
				</div>
			{/if}

			<div class="space-y-1 {requiereBancoYVoucher ? '' : 'md:col-span-2 max-w-sm'}">
				<Input 
					label="Monto Pagado (Bs)" 
					type="number" 
					step="0.01" 
					min="1"
					bind:value={montoComprobante} 
					required 
					disabled={!selectedEnrollmentId}
					class="font-bold text-primary-600 text-lg disabled:opacity-50"
					placeholder="Ej: 588.00" 
				/>
				{#if selectedEnrollmentId}
					<p class="text-xs text-blue-600 dark:text-blue-400 font-medium leading-tight">
						Se sugiere este monto, pero puedes modificarlo si pagaste una cantidad diferente. El sistema distribuirá tu saldo en cascada.
					</p>
				{/if}
			</div>
            
			{#if requiereBancoYVoucher}
				<div>
					<label for="fechaComprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha del Voucher</label>
					<input type="date" bind:value={fechaComprobante} required class="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm" />
				</div>

				<div class="md:col-span-2">
					<label for="cuentaDestino" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Destino (Nuestra Institución)</label>
					<select bind:value={cuentaDestino} required class="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
						<option value="">¿A qué cuenta realizó el pago?</option>
						{#each cuentasInstitucion as c} <option value={c}>{c}</option> {/each}
					</select>
				</div>

				<div class="md:col-span-2">
					<div class="space-y-1">
						<Input 
							label="Número de Transacción / Referencia" 
							bind:value={transactionNumber} 
							required 
							placeholder="Ej: 84729384" 
							class="font-mono tracking-widest text-lg"
						/>
						<p class="text-xs text-blue-600 dark:text-blue-400 font-medium">Sólo ingresa los números principales del recibo bancario.</p>
					</div>
				</div>
			{/if}
        </div>
    </div>

	{#if requiereBancoYVoucher}
		<div class="flex flex-col lg:flex-row gap-6 animate-fade-in">
			{#if qrUrl}
				<div class="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-white dark:bg-gray-800">
					<span class="text-xs font-bold text-gray-500 uppercase mb-2">Pagar vía QR</span>
					<img src={qrUrl} alt="QR" class="w-40 h-40 object-contain" />
				</div>
			{/if}

			<div class="flex-[2] space-y-1">
				<label for="comprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Archivo del Comprobante</label>
				<FileUpload
					id="comprobante"
					accept="image/*,application/pdf"
					{file}
					onFileSelect={(f) => file = f}
					label="Subir Imagen o PDF"
				/>
			</div>
		</div>
	{/if}

    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
