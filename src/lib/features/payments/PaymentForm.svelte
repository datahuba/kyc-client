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

	let remitente = $state('');
	let fecha_comprobante = $state('');
	let monto_comprobante = $state(0);
	let banco = $state('');
	let glosa = $state('');
	let cuenta_destino = $state('');


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
		if (!selectedEnrollmentId || !transactionNumber || !file) {
			alert('error', 'Todos los campos son obligatorios');
			return;
		}

		saving = true;
		try {
			const payload: CreatePaymentFormData = {
				inscripcion_id: selectedEnrollmentId,
				numero_transaccion: transactionNumber,
				file: file,
				remitente,
				fecha_comprobante,
				monto_comprobante,
				banco,
				glosa,
				cuenta_destino
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
						{enrollment.created_at.split('T')[0]} - Total: {enrollment.total_a_pagar} Bs. (Saldo: {enrollment.saldo_pendiente} Bs.)
					</option>
				{/each}
			</select>
		{/if}
	</div>

	<Input label="Número de Transacción" bind:value={transactionNumber} required placeholder="Ej: 12345678" />
	<Input label="Remitente" bind:value={remitente} required placeholder="Nombre del remitente" />
	<Input label="Fecha del Comprobante" type="date" bind:value={fecha_comprobante} required />
	<Input label="Monto del Comprobante" type="number" min="0" step="0.01" bind:value={monto_comprobante} required />
	<Input label="Banco" bind:value={banco} required placeholder="Banco emisor" />
	<Input label="Glosa" bind:value={glosa} placeholder="Opcional: detalle del pago" />
	<Input label="Cuenta Destino" bind:value={cuenta_destino} required placeholder="Cuenta destino" />

	<div class="flex items-center md:flex-row flex-col justify-center gap-4">

	
	{#if qrUrl}
		<div class="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">QR para Depósito</span>
			<img src={qrUrl} alt="Código QR para depósito" class="w-48 h-48 object-contain rounded-md shadow-sm" />
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Escanea este código para realizar el pago</p>
		</div>
	{/if}

	<div class="space-y-1">
		<label for="comprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Comprobante de Pago</label>
		<FileUpload
			id="comprobante"
			accept="image/*,application/pdf"
			{file}
			onFileSelect={(f) => file = f}
			label="Subir Comprobante (Imagen o PDF)"
		/>
	</div>
	</div>


	<div class="flex justify-end gap-3 pt-4">
		<Button type="button" variant="secondary" onclick={onCancel} disabled={saving}>Cancelar</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()} <UploadIcon class="size-5" /> {/snippet}
			Registrar Pago
		</Button>
	</div>
</form>
