<script lang="ts">
	// F-CERT-LIBRETA-RESUMEN (2026-08-18, Kevin en la capacitación)
	// ============================================================================
	// "Cuando le dé revisar, pueda ver los datos, pero no como sale ahorita que
	// te manda su gestión de pago, sino que te salga una nueva ventana, un pop
	// up (...) que sea la de solo los pagos de esa persona, como justamente la
	// ventana de la libreta de notas (...) nombre, remitente, fecha, y esa eso,
	// con número de comprobante, pago (...) con una opción que sea la de
	// imprimir, para que pueda imprimir solamente ese, un formato PDF (...) que
	// sea bonita la vista, y se imprima directamente."
	//
	// Antes, el botón "Verificar pagos" de la revisión del Certificado de No
	// Deudor abría /app/payments filtrado en OTRA PESTAÑA — la lista completa
	// de pagos del sistema, sin imprimir, perdiendo el contexto de la
	// solicitud que se estaba revisando.
	//
	// Este componente es una versión DE SOLO LECTURA del modal de Libreta que
	// ya existe en /app/enrollments (con su botón Imprimir y su tabla de
	// comprobantes). No reusa ese modal directamente porque tiene ~1700 líneas
	// con acciones administrativas que acá no aplican (congelar, matrícula
	// exenta, subir requisitos, validar notas de docente) — traerlas habría
	// sido un refactor riesgoso de una pantalla que ya funciona en producción.
	// Se reutiliza en cambio el mismo patrón: notas + módulos + tabla de
	// comprobantes con número de transacción y fecha, y el mismo CSS de
	// impresión (@media print con la clase .libreta-imprimible).
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { enrollmentService, paymentService } from '$lib/services';
	import { formatCurrency } from '$lib/utils';
	import type { Enrollment } from '$lib/interfaces';

	interface Props {
		isOpen: boolean;
		enrollmentId: string | null;
		onClose: () => void;
	}

	let { isOpen, enrollmentId, onClose }: Props = $props();

	let cargando = $state(false);
	let enrollment: Enrollment | null = $state(null);
	let pagos: any[] = $state([]);
	let error = $state('');

	$effect(() => {
		if (isOpen && enrollmentId) {
			cargarDatos(enrollmentId);
		} else if (!isOpen) {
			enrollment = null;
			pagos = [];
			error = '';
		}
	});

	async function cargarDatos(id: string) {
		cargando = true;
		error = '';
		try {
			const e = await enrollmentService.getById(id);
			enrollment = e;

			const estudianteId =
				typeof (e as any).estudiante_id === 'object'
					? (e as any).estudiante_id?._id
					: (e as any).estudiante_id;
			const cursoId =
				typeof (e as any).curso_id === 'object' ? (e as any).curso_id?._id : (e as any).curso_id;

			if (estudianteId && cursoId) {
				const resp = await paymentService.getAll(1, 200, {
					estudiante_id: String(estudianteId),
					curso_id: String(cursoId)
				});
				pagos = (resp as any)?.data ?? [];
			}
		} catch (e: any) {
			error = e?.message || 'No se pudieron cargar los pagos.';
		} finally {
			cargando = false;
		}
	}

	/** Fecha en formato boliviano. Mismo saneamiento ISO que el resto del sistema. */
	function fechaCorta(valor: any): string {
		if (!valor) return '--';
		try {
			let iso = String(valor).replace(' ', 'T');
			iso = iso.replace(/\.\d+/, '');
			if (!iso.endsWith('Z')) iso += 'Z';
			const d = new Date(iso);
			if (isNaN(d.getTime())) return '--';
			return d.toLocaleDateString('es-BO', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				timeZone: 'America/La_Paz'
			});
		} catch {
			return '--';
		}
	}

	function imprimir() {
		window.print();
	}
</script>

<Modal {isOpen} title="Resumen de Pagos" {onClose} maxWidth="sm:max-w-3xl">
	<div class="p-6 space-y-5 libreta-imprimible">
		{#if cargando}
			<p class="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
		{:else if error}
			<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
		{:else if enrollment}
			<div
				class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-dark-border dark:bg-dark-background/40 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						Programa
					</p>
					<p class="text-lg font-bold leading-tight text-slate-900 dark:text-white">
						{(enrollment as any).curso_nombre || '—'}
					</p>
					<p class="mt-1 text-sm font-semibold text-blue-600">
						Estudiante: {(enrollment as any).estudiante_nombre || '—'}
					</p>
				</div>
				<div
					class="rounded-xl border border-gray-100 bg-white px-6 py-3 text-left shadow-sm dark:border-dark-border dark:bg-dark-surface sm:text-right"
				>
					<p class="text-xs font-bold uppercase tracking-wider text-slate-500">Estado</p>
					<p class="mt-1 text-base font-bold text-slate-900 dark:text-white">
						{enrollment.estado}
					</p>
				</div>
			</div>

			<div class="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-dark-border">
				<div class="bg-gray-100 px-4 py-3 dark:bg-dark-background">
					<p class="text-xs font-bold uppercase tracking-wider text-slate-500">Comprobantes de pago</p>
				</div>
				{#if pagos.length === 0}
					<p class="px-4 py-4 text-sm text-slate-500">
						No hay pagos registrados para esta inscripción.
					</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
							<thead class="bg-gray-50 dark:bg-dark-background/60">
								<tr>
									<th class="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
										>Concepto</th
									>
									<th class="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
										>Remitente</th
									>
									<th class="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-500"
										>Monto (Bs)</th
									>
									<th class="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
										>N° Comprobante</th
									>
									<th class="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
										>Fecha</th
									>
									<th
										class="px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500"
										>Estado</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white dark:divide-dark-border dark:bg-dark-surface">
								{#each pagos as pago}
									<tr>
										<td class="px-4 py-3 text-sm text-slate-900 dark:text-white">
											{pago.concepto || '--'}
											{#if pago.numero_cuota}
												<span class="text-xs text-slate-500"> (cuota {pago.numero_cuota})</span>
											{/if}
										</td>
										<td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
											{pago.remitente || '--'}
										</td>
										<td class="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
											{formatCurrency(pago.cantidad_pago ?? 0)}
										</td>
										<td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
											<!-- En caja física no existe número de transferencia. -->
											{pago.numero_transaccion || (pago.metodo_pago === 'Caja' ? 'Caja' : '--')}
										</td>
										<td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
											{fechaCorta(pago.fecha_comprobante || pago.created_at)}
										</td>
										<td class="px-4 py-3 text-center">
											<span
												class="rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide {pago.estado_pago ===
												'Aprobado'
													? 'bg-green-100 text-green-700'
													: pago.estado_pago === 'Rechazado'
														? 'bg-red-100 text-red-700'
														: 'bg-slate-100 text-slate-600'}"
											>
												{pago.estado_pago || '--'}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-dark-border">
			<Button onclick={imprimir} disabled={!enrollment} class="no-print bg-primary-600 text-white hover:bg-primary-700">
				Imprimir
			</Button>
			<Button variant="secondary" onclick={onClose} class="no-print">Cerrar</Button>
		</div>
	</div>
</Modal>

<!-- Mismo CSS de impresión que la Libreta completa de /app/enrollments:
     solo el contenido marcado .libreta-imprimible llega al papel, con
     fondo blanco y texto negro. -->
<style>
	@media print {
		/* F-FIX-PRINT-PAGINA-EN-BLANCO (2026-08-19):
		   1. Ocultar todo lo que no sea libreta-imprimible
		   2. display:none en header, sidebar, nav, backdrops y no-print para que no ocupen espacio
		   3. Resetear alturas fijas (.h-dvh, main, relative) a static/auto para que no empujen a pagina 2
		   4. .libreta-imprimible posicionada a top:0, left:0 con padding prolijo */
		:global(body:has(.libreta-imprimible) *) {
			visibility: hidden;
		}
		:global(body:has(.libreta-imprimible) .libreta-imprimible),
		:global(body:has(.libreta-imprimible) .libreta-imprimible *) {
			visibility: visible;
		}

		:global(body:has(.libreta-imprimible) header),
		:global(body:has(.libreta-imprimible) aside),
		:global(body:has(.libreta-imprimible) nav),
		:global(body:has(.libreta-imprimible) .no-print),
		:global(body:has(.libreta-imprimible) .backdrop-blur-sm),
		:global(body:has(.libreta-imprimible) > .fixed) {
			display: none !important;
		}

		:global(html:has(.libreta-imprimible)),
		:global(body:has(.libreta-imprimible)) {
			height: auto !important;
			min-height: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			position: static !important;
			overflow: visible !important;
		}

		:global(body:has(.libreta-imprimible) .h-dvh),
		:global(body:has(.libreta-imprimible) .h-screen),
		:global(body:has(.libreta-imprimible) main),
		:global(body:has(.libreta-imprimible) .modal-sheet),
		:global(body:has(.libreta-imprimible) [role="dialog"]) {
			position: static !important;
			transform: none !important;
			inset: auto !important;
			height: auto !important;
			min-height: 0 !important;
			max-height: none !important;
			margin: 0 !important;
			padding: 0 !important;
			overflow: visible !important;
		}

		:global(.libreta-imprimible) {
			position: absolute !important;
			left: 0 !important;
			top: 0 !important;
			width: 100% !important;
			margin: 0 !important;
			padding: 1.5rem !important;
			transform: none !important;
			box-sizing: border-box !important;
		}

		:global(body:has(.libreta-imprimible) .overflow-hidden),
		:global(body:has(.libreta-imprimible) .overflow-y-auto),
		:global(body:has(.libreta-imprimible) .overflow-x-auto) {
			overflow: visible !important;
		}

		:global(.libreta-imprimible),
		:global(.libreta-imprimible *) {
			background: #fff !important;
			color: #000 !important;
			box-shadow: none !important;
		}
		:global(.libreta-imprimible table) {
			width: 100% !important;
			border-collapse: collapse !important;
			page-break-inside: auto;
		}
		:global(.libreta-imprimible tr) {
			page-break-inside: avoid;
			page-break-after: auto;
		}
	}
</style>
