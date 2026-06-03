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
	import { UploadIcon } from '$lib/icons/outline';

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
    let concepto = $state(''); // 'Matrícula' o 'Módulo'
    let remitente = $state('');
    let banco = $state('');
    let montoComprobante = $state<number | null>(null);
    let fechaComprobante = $state(new Date().toISOString().split('T')[0]); // Fecha actual
    let cuentaDestino = $state('');

	// Listas de ayuda para los select
    const bancosDisponibles = ["Banco Unión", "BNB", "Mercantil Santa Cruz", "Banco Bisa", "Banco Ganadero", "Banco Económico", "Yape", "Altoke", "Yolo", "Otro"];
    const cuentasInstitucion = ["Cta. Corriente BNB - 1234567", "Cta. Ahorros Unión - 9876543"];

	// Control reactivo: ocultar opción de matrícula si ya fue cancelada
	let showMatriculaOption = $derived(
		selectedEnrollmentId 
			? !enrollments.find(e => e._id === selectedEnrollmentId)?.matricula_pagada 
			: true
	);

	onMount(async () => {
		try {
			// Cargar configuración de QR y cursos
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

	// Efecto reactivo Svelte 5: Calcula y bloquea el monto exacto según el concepto elegido
	$effect(() => {
		if (!selectedEnrollmentId) {
			montoComprobante = null;
			concepto = '';
			return;
		}

		const enrollment = enrollments.find(e => e._id === selectedEnrollmentId);
		if (!enrollment) return;

		const course = coursesList.find(c => c._id === enrollment.curso_id);
		if (!course) return;

		// Determinar si el estudiante aplica a costos internos o externos
		const isInterno = enrollment.es_estudiante_interno === 'interno';

		if (concepto === 'Matrícula') {
			montoComprobante = isInterno ? course.matricula_interno : course.matricula_externo;
		} else if (concepto === 'Módulo') {
			// El costo total en tus cursos ya representa únicamente el total de los módulos,
			// por lo que solo debemos dividirlo directamente entre la cantidad de cuotas.
			const total = isInterno ? course.costo_total_interno : course.costo_total_externo;
			const cuotas = course.cantidad_cuotas || 1;
			
			// Redondeo seguro a 2 decimales
			montoComprobante = Math.round((total / cuotas) * 100) / 100;
		} else {
			montoComprobante = null;
		}
	});

	// Saneamiento automático reactivo Svelte 5 para el Número de Transacción (Bug 6)
	$effect(() => {
		if (transactionNumber) {
			const sanitized = transactionNumber.replace(/[^a-zA-Z0-9]/g, '');
			if (sanitized !== transactionNumber) {
				transactionNumber = sanitized;
			}
		}
	});

	async function handleSubmit() {
		if (!selectedEnrollmentId || !transactionNumber || !file || !remitente || !banco || montoComprobante === null || !cuentaDestino || !fechaComprobante || !concepto) {
			alert('error', 'Todos los campos son obligatorios');
			return;
		}

		// Doble validación Regex estricta de seguridad alfanumérica (Bug 6)
		const regexAlfanumerico = /^[a-zA-Z0-9]+$/;
		if (!regexAlfanumerico.test(transactionNumber)) {
			alert('error', 'El número de transacción solo debe contener letras y números (sin espacios ni símbolos)');
			return;
		}

		saving = true;
		try {
			// Añadimos el concepto elegido y el monto fijo al payload de envío
			const payload: any = {
				inscripcion_id: selectedEnrollmentId,
				numero_transaccion: transactionNumber,
				file: file,
                remitente,
                banco,
                monto_comprobante: montoComprobante!,
                fecha_comprobante: fechaComprobante,
                cuenta_destino: cuentaDestino,
				concepto, // 'Matrícula' o 'Módulo'
				cantidad_pago: montoComprobante!
			};

			await paymentService.create(payload);
			alert('success', 'Pago registrado correctamente');
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
		<!-- Selección de Inscripción -->
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

		<!-- Concepto de Pago Inteligente -->
		<div>
			<label for="concepto" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto de Pago</label>
			<select
				id="concepto"
				bind:value={concepto}
				required
				disabled={!selectedEnrollmentId}
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
			>
				<option value="">Seleccione Concepto</option>
				{#if showMatriculaOption}
					<option value="Matrícula">Matrícula</option>
				{/if}
				<option value="Módulo">Módulo / Cuota de Programa</option>
			</select>
		</div>
	</div>

    <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Detalles del Depósito/Transferencia</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre del Remitente" bind:value={remitente} required placeholder="Como figura en el voucher" />
            
            <div>
                <label for="banco" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco</label>
                <select bind:value={banco} required class="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:text-white sm:text-sm">
                    <option value="">Seleccione Banco</option>
                    {#each bancosDisponibles as b} <option value={b}>{b}</option> {/each}
                </select>
            </div>

			<!-- Campo de Monto Bloqueado (Readonly) si ya se seleccionó un concepto para evitar digitaciones erróneas -->
            <Input 
				label="Monto Pagado (Bs)" 
				type="number" 
				step="0.01" 
				bind:value={montoComprobante} 
				required 
				readonly={!!concepto}
				class={concepto ? 'bg-gray-100 dark:bg-gray-800 font-semibold text-primary-600' : ''}
				placeholder="Seleccione concepto primero" 
			/>
            
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
				<Input label="Número de Transacción / Referencia" bind:value={transactionNumber} required placeholder="Ej: 84729384 o ABC12345" />
			</div>
        </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
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

    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onclick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>
            {#snippet leftIcon()} <UploadIcon class="size-5" /> {/snippet}
            Confirmar Pago
        </Button>
    </div>
</form>
