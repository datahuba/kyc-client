<script lang="ts">
	import { onMount } from 'svelte';
	import { enrollmentService, paymentService, paymentConfigService } from '$lib/services';
	import type { Enrollment, CreatePaymentFormData } from '$lib/interfaces';
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
	let loading = $state(true);
	let saving = $state(false);
	
	let selectedEnrollmentId = $state('');
	let transactionNumber = $state('');
	let file: File | null = $state(null);
	let qrUrl = $state('');

	// --- NUEVOS ESTADOS ---
    let remitente = $state('');
    let banco = $state('');
    let montoComprobante = $state<number | null>(null);
    let fechaComprobante = $state(new Date().toISOString().split('T')[0]); // Fecha actual
    let cuentaDestino = $state('');

	// Listas de ayuda para los select (puedes personalizarlas)
    const bancosDisponibles = ["Banco Unión", "BNB", "Mercantil Santa Cruz", "Banco Bisa", "Banco Ganadero", "Banco Económico", "Otro"];
    const cuentasInstitucion = ["Cta. Corriente BNB - 1234567", "Cta. Ahorros Unión - 9876543"];

	onMount(async () => {
		try {
			// Fetch payment config concurrently with enrollments if possible, but sequential is fine for now
			const config = await paymentConfigService.get();
			if (config && config.qr_url) {
				qrUrl = config.qr_url;
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

	async function handleSubmit() {
		if (!selectedEnrollmentId || !transactionNumber || !file || !remitente || !banco || montoComprobante === null || !cuentaDestino || !fechaComprobante) {
			alert('error', 'Todos los campos son obligatorios');
			return;
		}

		saving = true;
		try {
			const payload: CreatePaymentFormData = {
				inscripcion_id: selectedEnrollmentId,
				numero_transaccion: transactionNumber,
				file: file,
				// NUEVOS CAMPOS
                remitente,
                banco,
                monto_comprobante: montoComprobante!,
                fecha_comprobante: fechaComprobante,
                cuenta_destino: cuentaDestino
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
    <div>
        <label for="enrollment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inscripción</label>
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
                        {enrollment.created_at.split('T')[0]} - Saldo: {enrollment.saldo_pendiente} Bs.
                    </option>
                {/each}
            </select>
        {/if}
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

            <Input label="Monto Pagado (Bs)" type="number" step="0.01" bind:value={montoComprobante} required placeholder="0.00" />
            
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
                <Input label="Número de Transacción / Referencia" bind:value={transactionNumber} required placeholder="Ej: 84729384" />
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
