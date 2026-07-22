<script lang="ts">
	/**
	 * F-COBRANZA-011 (2026-07-21): Modal para que COBRANZA suba el comprobante
	 * de pago en nombre del estudiante.
	 *
	 * Decisión de Joel: solo cobranza (no encargado_curso, no coordinador, no
	 * cpd) puede usar este modal. Se muestra en /app/payments cuando el pago
	 * no tiene comprobante_url todavía.
	 *
	 * Backend: POST /api/v1/payments/{id}/upload-by-encargado
	 *   - Roles permitidos: superadmin, admin, cobranza.
	 *   - Recibe: file (imagen o PDF), numero_transaccion, remitente,
	 *     fecha_comprobante (todos opcionales salvo file).
	 *   - Devuelve: el Payment actualizado (incluye comprobante_url nuevo).
	 *
	 * El pago NO se vuelve a aprobar (ya estaba aprobado por F-COBRANZA-004 al
	 * subirlo el estudiante). Solo se adjunta el comprobante. Por eso el modal
	 * NO pide monto ni método: esos datos ya están en el pago.
	 */
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { paymentService } from '$lib/services';
	import { alert } from '$lib/utils';
	import type { Payment } from '$lib/interfaces';

	interface Props {
		isOpen: boolean;
		payment: Payment | null;
		onSuccess: (updatedPayment: Payment) => void;
		onCancel: () => void;
	}

	let { isOpen, payment, onSuccess, onCancel }: Props = $props();

	let file: File | null = $state(null);
	let numeroTransaccion = $state('');
	let remitente = $state('');
	let fechaComprobante = $state(new Date().toISOString().split('T')[0]);
	let saving = $state(false);

	// Reset form cuando se abre el modal
	$effect(() => {
		if (isOpen) {
			file = null;
			numeroTransaccion = payment?.numero_transaccion ?? '';
			remitente = payment?.remitente ?? '';
			fechaComprobante = payment?.fecha_comprobante
				? new Date(payment.fecha_comprobante).toISOString().split('T')[0]
				: new Date().toISOString().split('T')[0];
		}
	});

	async function handleSubmit() {
		if (!payment) return;
		if (!file) {
			alert('error', 'Debe seleccionar un archivo de comprobante (imagen o PDF).');
			return;
		}

		saving = true;
		try {
			const updated = await paymentService.uploadByEncargado(payment._id, file, {
				numero_transaccion: numeroTransaccion || undefined,
				remitente: remitente || undefined,
				fecha_comprobante: fechaComprobante || undefined,
			});
			alert('success', 'Comprobante subido correctamente. El estudiante fue notificado.');
			onSuccess(updated);
		} catch (e: any) {
			console.error('Error al subir comprobante:', e);
			alert('error', e?.response?.data?.detail || e?.message || 'No se pudo subir el comprobante.');
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	{isOpen}
	title="Subir comprobante de pago"
	onClose={onCancel}
	maxWidth="sm:max-w-xl"
>
	{#if payment}
		<div class="space-y-5 p-4">
			<!-- Info del pago (read-only) -->
			<div class="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-4">
				<p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
					Pago seleccionado
				</p>
				<div class="mt-2 grid grid-cols-2 gap-2 text-sm">
					<div>
						<span class="text-gray-500 dark:text-gray-400">Estudiante:</span>
						<span class="ml-1 font-medium text-gray-900 dark:text-white">
							{(payment as any).nombre_estudiante ?? payment.estudiante_id}
						</span>
					</div>
					<div>
						<span class="text-gray-500 dark:text-gray-400">Monto:</span>
						<span class="ml-1 font-bold text-green-600 dark:text-green-400">
							Bs {payment.cantidad_pago?.toFixed(2) ?? '0.00'}
						</span>
					</div>
					<div>
						<span class="text-gray-500 dark:text-gray-400">Concepto:</span>
						<span class="ml-1 font-medium text-gray-900 dark:text-white">
							{payment.concepto ?? '—'}
						</span>
					</div>
					<div>
						<span class="text-gray-500 dark:text-gray-400">Nº Transacción:</span>
						<span class="ml-1 font-mono text-xs text-gray-900 dark:text-white">
							{payment.numero_transaccion ?? 'S/N'}
						</span>
					</div>
				</div>
			</div>

			<!-- Subir archivo (obligatorio) -->
			<FileUpload
				id="comprobante_file"
				label="Comprobante (imagen o PDF)"
				accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
				{file}
				onFileSelect={(f) => (file = f)}
				loading={saving}
			/>

			<!-- Datos opcionales pre-llenados si ya existían -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<Input
					id="numero_transaccion"
					label="Nº de Transacción"
					bind:value={numeroTransaccion}
					placeholder="Opcional"
				/>
				<Input
					id="remitente"
					label="Remitente"
					bind:value={remitente}
					placeholder="Opcional"
				/>
			</div>

			<Input
				id="fecha_comprobante"
				label="Fecha del comprobante"
				type="date"
				bind:value={fechaComprobante}
			/>

			<p class="text-xs text-gray-500 dark:text-gray-400">
				<i class="fa-solid fa-info-circle mr-1"></i>
				Esta acción queda registrada en la auditoría. El estudiante recibirá una notificación.
			</p>
		</div>

		<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
			<Button variant="secondary" onclick={onCancel} disabled={saving}>
				Cancelar
			</Button>
			<Button onclick={handleSubmit} loading={saving} disabled={!file}>
				Subir comprobante
			</Button>
		</div>
	{/if}
</Modal>
