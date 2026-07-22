<script lang="ts">
	/**
	 * F-COBRANZA-011 (2026-07-21): Modal para que COBRANZA suba o REEMPLACE
	 * el comprobante de pago en nombre del estudiante.
	 *
	 * Decisión de Joel: solo cobranza (no encargado_curso, no coordinador, no
	 * cpd) puede usar este modal. Se muestra en /app/payments desde el menú
	 * de 3 puntos. Si el pago ya tiene comprobante, el modal lo muestra
	 * previsualizado y permite REEMPLAZARLO (subir uno nuevo).
	 *
	 * Cambio 2026-07-21 20:58: Joel reportó que no encontraba el botón. La UI
	 * anterior solo lo mostraba si el pago NO tenía comprobante. Como los 67
	 * pagos actuales ya tienen comprobante subido por los estudiantes, el
	 * botón no aparecía nunca. Ahora se muestra SIEMPRE para cobranza/admin/
	 * superadmin, con label "Subir comprobante" o "Reemplazar comprobante"
	 * según el caso.
	 *
	 * Backend: POST /api/v1/payments/{id}/upload-by-encargado
	 *   - Roles permitidos: superadmin, admin, cobranza.
	 *   - Recibe: file (imagen o PDF), numero_transaccion, remitente,
	 *     fecha_comprobante (todos opcionales salvo file).
	 *   - Devuelve: el Payment actualizado (incluye comprobante_url nuevo).
	 *
	 * El pago NO se vuelve a aprobar (ya estaba aprobado por F-COBRANZA-004 al
	 * subirlo el estudiante). Solo se adjunta/reemplaza el comprobante. Por
	 * eso el modal NO pide monto ni método: esos datos ya están en el pago.
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
			const accion = payment.comprobante_url ? 'reemplazado' : 'subido';
			alert('success', `Comprobante ${accion} correctamente. El estudiante fue notificado.`);
			onSuccess(updated);
		} catch (e: any) {
			console.error('Error al subir comprobante:', e);
			alert('error', e?.response?.data?.detail || e?.message || 'No se pudo subir el comprobante.');
		} finally {
			saving = false;
		}
	}

	const modalTitle = $derived(
		payment?.comprobante_url ? 'Reemplazar comprobante de pago' : 'Subir comprobante de pago'
	);
</script>

<Modal
	{isOpen}
	title={modalTitle}
	onClose={onCancel}
	maxWidth="sm:max-w-xl"
>
	{#if payment}
		<div class="space-y-5 p-4">
			<!-- Comprobante actual (si existe) — F-COBRANZA-011 (reemplazo) -->
			{#if payment.comprobante_url}
				<div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4">
					<div class="flex items-start gap-3">
						<svg class="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold text-amber-800 dark:text-amber-200">
								Este pago ya tiene un comprobante
							</p>
							<p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
								Si subes un archivo nuevo, se va a REEMPLAZAR el actual. La auditoría registra ambos eventos.
							</p>
							<div class="mt-3 flex items-center gap-2 flex-wrap">
								<a
									href={payment.comprobante_url}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
								>
									<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
									Ver comprobante actual
								</a>
							</div>
						</div>
					</div>
				</div>
			{/if}

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
				{payment.comprobante_url ? 'Reemplazar comprobante' : 'Subir comprobante'}
			</Button>
		</div>
	{/if}
</Modal>
