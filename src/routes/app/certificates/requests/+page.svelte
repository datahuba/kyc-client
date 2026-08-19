<script lang="ts">
	/**
	 * /app/certificates/requests — Cola de solicitudes de certificado
	 *
	 * F-CERT-APROBACION (2026-07-30): panel del encargado del programa
	 * (rol ENCARGADO_CURSO con cursos_asignados) o admin/superadmin
	 * para revisar y APROBAR/RECHAZAR las solicitudes de certificados
	 * de Notas y No Deudor que crean los estudiantes.
	 *
	 * Filtra automáticamente por cursos_asignados del encargado. Si es
	 * admin/superadmin, ve TODAS las solicitudes.
	 *
	 * - KPIs arriba (pendientes, en revisión, aprobadas hoy, rechazadas hoy).
	 * - Filtros por estado.
	 * - Lista de solicitudes con tarjeta por item.
	 * - Modal de detalle con botones Aprobar / Rechazar (con motivo) / En revisión.
	 */

	import { onMount } from 'svelte';
	import { certificateService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type {
		CertificateRequest,
		CertificateRequestEstado,
		CertificateRequestStats
	} from '$lib/interfaces';

	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import LibretaResumenModal from '$lib/features/enrollments/LibretaResumenModal.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import {
		FileTextIcon,
		IdentificationIcon,
		BellIcon,
		RefreshIcon,
		CircleCheckIcon,
		XIcon,
		EyeIcon,
		DownloadIcon
	} from '$lib/icons/outline';

	// ========================================================================
	// STATE
	// ========================================================================

	let requests = $state<CertificateRequest[]>([]);
	let stats = $state<CertificateRequestStats | null>(null);
	let loading = $state(true);
	let statsLoading = $state(true);
	let filtro = $state<'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada' | 'todas'>(
		'pendiente'
	);
	let total = $state(0);
	const perPage = 30;

	// Modal de detalle
	let detailOpen = $state(false);
	let selectedRequest = $state<CertificateRequest | null>(null);
	let detailLoading = $state(false);
	let actionInProgress = $state(false);

	// F-CERT-NO-DEUDOR-COBRO (2026-08-17)
	// Tratamiento profesional elegido al aprobar (vacío = sin tratamiento,
	// que es lo que corresponde a los de diplomado continuo) y nota opcional
	// al confirmar la firma física.
	let tratamientoElegido = $state('');
	let observacionFirma = $state('');

	// F-CERT-GATE-IMPRESION (2026-08-18, Kevin en la capacitación): "una vez
	// impreso, recién salga la siguiente opción del flujo, que sea la de
	// marcar la casilla que ya está firmado para la copia física". El
	// documento que se imprime acá es el certificado ya emitido (botón
	// "Descargar PDF", visible apenas se aprueba) — eso es lo que la
	// coordinadora le lleva a Fausto para que lo firme en papel.
	//
	// El navegador no avisa de forma confiable si el diálogo de impresión se
	// completó o se canceló, así que el gate no se dispara solo al abrirlo:
	// es una confirmación EXPLÍCITA de la persona ("ya lo imprimí y lo tengo
	// en mano"), que es lo que realmente hace falta asegurar antes de que se
	// pueda decir que el papel está firmado.
	let confirmoImpresionCert = $state(false);

	// Modal de rechazo
	let rejectOpen = $state(false);
	let rejectTarget = $state<CertificateRequest | null>(null);
	let rejectMotivo = $state('');
	let rejectLoading = $state(false);

	// ========================================================================
	// HELPERS
	// ========================================================================

	function getUserRole(): string {
		const u: any = $userStore?.user;
		return String(u?.role || u?.rol || '');
	}

	function esCoordinadorFinanciero(): boolean {
		const u: any = $userStore?.user;
		return getUserRole() === 'coordinador' && u?.subtipo_coordinador === 'financiero';
	}

	/**
	 * Quién puede aprobar ESTA solicitud.
	 *
	 * F-CERT-NO-DEUDOR-COBRO (2026-08-17): el No Deudor se separó del flujo de
	 * Notas. Solo lo aprueban el coordinador financiero y el superadmin —
	 * ahora acredita que no hay deuda Y cobra un arancel, o sea que es una
	 * decisión económica, no académica. El backend impone lo mismo; esto es
	 * para no mostrar botones que van a devolver 403.
	 */
	function canApprove(req?: CertificateRequest | null): boolean {
		const role = getUserRole();
		const tipo = req?.tipo ?? (selectedRequest?.tipo || 'notas');
		if (tipo === 'no_deudor') {
			return role === 'superadmin' || esCoordinadorFinanciero();
		}
		return ['admin', 'superadmin', 'encargado_curso'].includes(role);
	}

	/** Tratamientos admitidos, en espejo con TRATAMIENTOS_VALIDOS del backend. */
	const TRATAMIENTOS = ['Lic.', 'Lic.a', 'Ing.', 'Arq.', 'Dr.', 'Dra.', 'Msc.', 'Tec.'];

	function fmtBs(n: number | null | undefined): string {
		if (n === null || n === undefined) return '—';
		return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function fmtDate(s: string | null | undefined): string {
		if (!s) return '—';
		let c = s.trim().replace(' ', 'T');
		if (c.includes('.')) c = c.split('.')[0];
		if (!c.endsWith('Z') && !c.includes('+')) c += 'Z';
		const d = new Date(c);
		if (isNaN(d.getTime())) return s;
		return (
			d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) +
			' ' +
			d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
		);
	}

	function estadoBadge(estado: string): string {
		switch (estado) {
			case 'pendiente':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
			case 'en_revision':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
			case 'aprobada':
				return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
			case 'rechazada':
				return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
			case 'cancelada':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function estadoLabel(estado: string): string {
		switch (estado) {
			case 'pendiente':
				return 'Pendiente';
			case 'en_revision':
				return 'En revisión';
			case 'aprobada':
				return 'Aprobada';
			case 'rechazada':
				return 'Rechazada';
			case 'cancelada':
				return 'Cancelada';
			default:
				return estado;
		}
	}

	function tipoLabel(tipo: string, hastaN?: number | null): string {
		if (tipo === 'notas') return 'Certificado de Notas';
		if (tipo === 'no_deudor') return `No Deudor (hasta Módulo ${hastaN ?? '?'})`;
		return tipo;
	}

	// ========================================================================
	// DATA LOADING
	// ========================================================================

	async function loadRequests() {
		loading = true;
		try {
			const estadoParam = filtro === 'todas' ? undefined : (filtro as CertificateRequestEstado);
			const resp = await certificateService.listRequestsQueue(estadoParam, 1, perPage);
			requests = resp.items;
			total = resp.total;
		} catch (e: any) {
			console.error('Error cargando solicitudes:', e);
			const detail = e?.response?.data?.detail || e?.message || 'No se pudieron cargar las solicitudes.';
			alert('error', detail);
		} finally {
			loading = false;
		}
	}

	async function loadStats() {
		statsLoading = true;
		try {
			stats = await certificateService.getRequestsStats();
		} catch (e: any) {
			console.warn('No se pudieron cargar stats:', e);
			stats = null;
		} finally {
			statsLoading = false;
		}
	}

	onMount(() => {
		loadRequests();
		loadStats();
	});

	// ========================================================================
	// ACTIONS
	// ========================================================================

	async function openDetail(req: CertificateRequest) {
		selectedRequest = req;
		// Se arrastra el tratamiento ya guardado si lo hubiera; si no, arranca
		// vacío en vez de con un valor por defecto: poner "Lic." de arranque
		// haría que se apruebe con un título que nadie eligió.
		tratamientoElegido = req.tratamiento ?? '';
		observacionFirma = '';
		confirmoImpresionCert = false;
		detailOpen = true;
		// Si está pendiente, lo marcamos en_revision al abrirlo (UX: "lo estoy mirando")
		if (req.estado === 'pendiente' && canApprove(req)) {
			detailLoading = true;
			try {
				const updated = await certificateService.markRequestInReview(req.id);
				// Actualizar en la lista
				requests = requests.map((r) => (r.id === updated.id ? updated : r));
				selectedRequest = updated;
			} catch (e: any) {
				console.warn('No se pudo marcar en revisión:', e);
			} finally {
				detailLoading = false;
			}
		}
	}

	function closeDetail() {
		if (actionInProgress) return;
		detailOpen = false;
		selectedRequest = null;
	}

	async function approve() {
		if (!selectedRequest || actionInProgress) return;
		const esNoDeudor = selectedRequest.tipo === 'no_deudor';
		actionInProgress = true;
		try {
			const updated = await certificateService.approveRequest(
				selectedRequest.id,
				esNoDeudor ? tratamientoElegido || null : null
			);
			requests = requests.map((r) => (r.id === updated.id ? updated : r));
			selectedRequest = updated;
			// El mensaje distingue los dos flujos a propósito: si dijera solo
			// "aprobada" en el No Deudor, el coordinador se iría creyendo que
			// el estudiante ya lo tiene, cuando todavía falta la firma.
			alert(
				'success',
				esNoDeudor
					? 'Aprobada y certificado emitido. Falta confirmar la firma física para que el estudiante pueda descargarlo.'
					: 'Solicitud aprobada. El certificado fue emitido.'
			);
			await loadStats();
		} catch (e: any) {
			console.error('Error aprobando:', e);
			const detail = e?.response?.data?.detail || e?.message || 'No se pudo aprobar la solicitud.';
			alert('error', detail);
		} finally {
			actionInProgress = false;
		}
	}

	/**
	 * Segundo paso del No Deudor: el coordinador ya hizo firmar la copia
	 * física y con esto habilita al estudiante a descargar el PDF.
	 */
	async function confirmarFirma() {
		if (!selectedRequest || actionInProgress) return;
		actionInProgress = true;
		try {
			const updated = await certificateService.confirmSignature(
				selectedRequest.id,
				observacionFirma.trim() || undefined
			);
			requests = requests.map((r) => (r.id === updated.id ? updated : r));
			selectedRequest = updated;
			observacionFirma = '';
			confirmoImpresionCert = false;
			alert('success', 'Firma confirmada. El estudiante ya puede descargar su certificado.');
		} catch (e: any) {
			console.error('Error confirmando firma:', e);
			const detail =
				e?.response?.data?.detail || e?.message || 'No se pudo confirmar la firma física.';
			alert('error', detail);
		} finally {
			actionInProgress = false;
		}
	}

	/**
	 * Abre los pagos de ESTE estudiante en ESTE programa, en otra pestaña.
	 *
	 * Kevin lo pidió explícitamente: antes de aprobar hay que poder chequear
	 * que el estudiante efectivamente no debe, sin perder la solicitud que se
	 * está mirando.
	 */
	// F-CERT-LIBRETA-RESUMEN (2026-08-18, Kevin en la capacitación): antes
	// esto abria /app/payments filtrado en OTRA PESTAÑA — la lista completa
	// de pagos del sistema, sin imprimir. Ahora abre un pop-up de solo los
	// pagos de ESTA persona, con boton Imprimir, sin perder de vista la
	// solicitud que se esta revisando.
	let libretaOpen = $state(false);

	function verificarPagos() {
		if (!selectedRequest) return;
		libretaOpen = true;
	}

	function openReject() {
		if (!selectedRequest) return;
		rejectTarget = selectedRequest;
		rejectMotivo = '';
		rejectOpen = true;
	}

	async function confirmReject() {
		if (!rejectTarget || rejectMotivo.trim().length < 5) return;
		rejectLoading = true;
		try {
			const updated = await certificateService.rejectRequest(
				rejectTarget.id,
				rejectMotivo.trim()
			);
			requests = requests.map((r) => (r.id === updated.id ? updated : r));
			// Si el detail está abierto sobre la misma solicitud, actualizar
			if (selectedRequest && selectedRequest.id === updated.id) {
				selectedRequest = updated;
			}
			rejectOpen = false;
			rejectTarget = null;
			alert('success', 'Solicitud rechazada.');
			await loadStats();
		} catch (e: any) {
			console.error('Error rechazando:', e);
			const detail = e?.response?.data?.detail || e?.message || 'No se pudo rechazar la solicitud.';
			alert('error', detail);
		} finally {
			rejectLoading = false;
		}
	}

	async function downloadCertPdf() {
		if (!selectedRequest?.certificate_id) return;
		// F-FIX-DESCARGA-PDF-RACE (2026-08-19): antes se leia
		// `selectedRequest.tipo`/`.id` DESPUES del await de downloadPdf().
		// Si el usuario cerraba el modal (o navegaba) mientras la descarga
		// estaba en curso, `selectedRequest` podia quedar en null y el
		// acceso reventaba con "Cannot read properties of null (reading
		// 'tipo')" — visto en vivo en consola durante la capacitacion.
		// Se capturan los valores ANTES del await, que es lo unico que
		// necesita el nombre del archivo.
		const certificateId = selectedRequest.certificate_id;
		const tipo = selectedRequest.tipo;
		const id = selectedRequest.id;
		try {
			const blob = await certificateService.downloadPdf(certificateId);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `certificado_${tipo}_${id}.pdf`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e: any) {
			console.error('Error descargando PDF:', e);
			alert('error', 'No se pudo descargar el PDF.');
		}
	}
</script>


<svelte:head>
	<title>Solicitudes de Certificado · KYC DataHub</title>
</svelte:head>
<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<Heading level="h1">Solicitudes de Certificados</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Revisa y aprueba las solicitudes de certificados de Notas y No Deudor creadas por los
				estudiantes. Al aprobar, el certificado se emite automáticamente.
			</p>
		</div>
		<Button variant="secondary" size="sm" onclick={() => { loadRequests(); loadStats(); }}>
			<RefreshIcon class="w-4 h-4 mr-1.5" />Refrescar
		</Button>
	</div>

	<!-- KPIs -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<Card padding="sm">
			<div class="flex items-center gap-2 mb-1">
				<BellIcon class="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
				<span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
					Pendientes
				</span>
			</div>
			<p class="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
				{statsLoading ? '…' : stats?.pendientes ?? 0}
			</p>
		</Card>
		<Card padding="sm">
			<div class="flex items-center gap-2 mb-1">
				<EyeIcon class="w-4 h-4 text-blue-600 dark:text-blue-400" />
				<span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
					En revisión
				</span>
			</div>
			<p class="text-2xl font-bold text-blue-700 dark:text-blue-300">
				{statsLoading ? '…' : stats?.en_revision ?? 0}
			</p>
		</Card>
		<Card padding="sm">
			<div class="flex items-center gap-2 mb-1">
				<CircleCheckIcon class="w-4 h-4 text-green-600 dark:text-green-400" />
				<span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
					Aprobadas hoy
				</span>
			</div>
			<p class="text-2xl font-bold text-green-700 dark:text-green-300">
				{statsLoading ? '…' : stats?.aprobadas_hoy ?? 0}
			</p>
		</Card>
		<Card padding="sm">
			<div class="flex items-center gap-2 mb-1">
				<XIcon class="w-4 h-4 text-red-600 dark:text-red-400" />
				<span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
					Rechazadas hoy
				</span>
			</div>
			<p class="text-2xl font-bold text-red-700 dark:text-red-300">
				{statsLoading ? '…' : stats?.rechazadas_hoy ?? 0}
			</p>
		</Card>
	</div>

	<!-- Filtros -->
	<div class="flex flex-wrap gap-2">
		{#each ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada', 'todas'] as f}
			<button
				type="button"
				onclick={() => {
					filtro = f as any;
					loadRequests();
				}}
				class={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
					filtro === f
						? 'bg-primary-600 text-white'
						: 'bg-gray-100 text-gray-600 dark:bg-dark-surface dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border'
				}`}
			>
				{f.replace('_', ' ')}
			</button>
		{/each}
		<span class="ml-auto text-xs text-gray-500 dark:text-gray-400 self-center">
			{total} solicitud{total !== 1 ? 'es' : ''}
		</span>
	</div>

	<!-- Lista -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
		</div>
	{:else if requests.length === 0}
		<EmptyState
			title="No hay solicitudes {filtro !== 'todas' ? estadoLabel(filtro).toLowerCase() + 's' : ''}"
			description="Cuando los estudiantes creen solicitudes de certificados aparecerán aquí."
		/>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each requests as req (req.id)}
				<button
					type="button"
					onclick={() => openDetail(req)}
					class="text-left bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-sm p-4 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 mb-1">
								{#if req.tipo === 'notas'}
									<FileTextIcon class="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
								{:else}
									<IdentificationIcon class="w-4 h-4 text-uagrm-blue dark:text-dark-tertiary shrink-0" />
								{/if}
								<h3 class="text-sm font-bold text-gray-900 dark:text-white truncate">
									{tipoLabel(req.tipo, req.hasta_modulo_n)}
								</h3>
							</div>
							<p class="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">
								{req.nombre_completo}
							</p>
							<p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
								{req.programa_nombre}
								{#if req.programa_codigo}
									<span class="text-gray-400">({req.programa_codigo})</span>
								{/if}
							</p>
						</div>
						<span
							class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadge(req.estado)}`}
						>
							{estadoLabel(req.estado)}
						</span>
					</div>

					{#if req.motivo}
						<p
							class="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2 line-clamp-2"
						>
							<span class="font-semibold text-gray-700 dark:text-gray-300">Motivo:</span>
							{req.motivo}
						</p>
					{/if}

					{#if req.estado === 'rechazada' && req.motivo_rechazo}
						<p class="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
							<span class="font-semibold">Rechazo:</span> {req.motivo_rechazo}
						</p>
					{/if}

					<div class="mt-3 flex items-center justify-between">
						<span class="text-[11px] text-gray-400 dark:text-gray-500">
							{fmtDate(req.created_at)}
						</span>
						{#if canApprove(req) && (req.estado === 'pendiente' || req.estado === 'en_revision')}
							<span class="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
								Click para revisar →
							</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal de detalle -->
<Modal
	isOpen={detailOpen}
	title="Detalle de la Solicitud"
	onClose={closeDetail}
	maxWidth="sm:max-w-2xl"
>
	{#if selectedRequest}
		<div class="p-6 space-y-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<div class="flex items-center gap-2 mb-1">
						{#if selectedRequest.tipo === 'notas'}
							<FileTextIcon class="w-5 h-5 text-primary-600" />
						{:else}
							<IdentificationIcon class="w-5 h-5 text-uagrm-blue" />
						{/if}
						<h3 class="text-base font-bold text-gray-900 dark:text-white">
							{tipoLabel(selectedRequest.tipo, selectedRequest.hasta_modulo_n)}
						</h3>
					</div>
					<span
						class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoBadge(selectedRequest.estado)}`}
					>
						{estadoLabel(selectedRequest.estado)}
					</span>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 text-sm">
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Estudiante</p>
					<p class="font-medium text-gray-900 dark:text-white">{selectedRequest.nombre_completo}</p>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Programa</p>
					<p class="font-medium text-gray-900 dark:text-white">
						{selectedRequest.programa_nombre}
						{#if selectedRequest.programa_codigo}
							<span class="text-gray-400 text-xs">({selectedRequest.programa_codigo})</span>
						{/if}
					</p>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Solicitada</p>
					<p class="font-medium text-gray-900 dark:text-white">{fmtDate(selectedRequest.created_at)}</p>
				</div>
				{#if selectedRequest.fecha_revision}
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Revisada</p>
						<p class="font-medium text-gray-900 dark:text-white">
							{fmtDate(selectedRequest.fecha_revision)}
							{#if selectedRequest.revisado_por}
								<span class="text-xs text-gray-400">por {selectedRequest.revisado_por}</span>
							{/if}
						</p>
					</div>
				{/if}
			</div>

			{#if selectedRequest.motivo}
				<div>
					<p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Motivo de la solicitud</p>
					<p class="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-background/40 rounded-lg p-3">
						{selectedRequest.motivo}
					</p>
				</div>
			{/if}

			{#if selectedRequest.estado === 'rechazada' && selectedRequest.motivo_rechazo}
				<div>
					<p class="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Motivo del rechazo</p>
					<p class="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
						{selectedRequest.motivo_rechazo}
					</p>
				</div>
			{/if}

			<!-- ============================================================
			     F-CERT-NO-DEUDOR-COBRO (2026-08-17): bloque económico.
			     Solo para 'no_deudor', que es el único con arancel.
			     ============================================================ -->
			{#if selectedRequest.tipo === 'no_deudor'}
				<div class="rounded-lg border border-gray-200 dark:border-dark-border p-3 space-y-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="text-xs font-semibold text-gray-700 dark:text-gray-300">Arancel del certificado</p>
							<p class="text-lg font-bold text-primary-700 dark:text-primary-300">
								{fmtBs(selectedRequest.monto)}
							</p>
						</div>
						<Button variant="secondary" size="sm" onclick={verificarPagos}>
							<EyeIcon class="w-4 h-4 mr-1.5" />Verificar pagos
						</Button>
					</div>

					{#if selectedRequest.comprobante_url}
						<a
							href={selectedRequest.comprobante_url}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
						>
							<FileTextIcon class="w-4 h-4" />Ver comprobante adjunto
						</a>
					{:else}
						<!-- No bloquea la aprobación: el estudiante puede haber
						     pagado en caja física, y para eso está el botón de
						     "Verificar pagos". Pero tiene que verse. -->
						<p class="text-sm text-amber-700 dark:text-amber-400">
							El estudiante no adjuntó comprobante. Verificá el pago en caja antes de aprobar.
						</p>
					{/if}
				</div>
			{/if}

			{#if selectedRequest.certificate_id}
				<div class="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
					<div class="flex items-center gap-2">
						<CircleCheckIcon class="w-5 h-5 text-green-600 dark:text-green-400" />
						<p class="text-sm font-medium text-green-800 dark:text-green-300">
							Certificado emitido · ID: {selectedRequest.certificate_id.slice(0, 8)}…
						</p>
					</div>
				</div>
			{/if}

			<!-- ============================================================
			     Segundo paso del No Deudor: firma física.
			     Aprobar ya emitió el PDF, pero el estudiante no lo ve hasta
			     que se confirme acá. Kevin: "el coordinador hace firmar la
			     copia física y debe habilitar al estudiante".
			     ============================================================ -->
			{#if selectedRequest.tipo === 'no_deudor' && selectedRequest.estado === 'aprobada'}
				{#if selectedRequest.firma_fisica_confirmada}
					<div class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
						<p class="text-sm font-medium text-green-800 dark:text-green-300">
							Firma física confirmada por {selectedRequest.confirmada_por ?? '—'} ·
							{fmtDate(selectedRequest.fecha_firma_fisica)}
						</p>
						<p class="mt-0.5 text-xs text-green-700 dark:text-green-400">
							El estudiante ya puede descargar su certificado.
						</p>
						{#if selectedRequest.observacion_firma}
							<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
								{selectedRequest.observacion_firma}
							</p>
						{/if}
					</div>
				{:else}
					<div class="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
						<p class="text-sm font-semibold text-amber-800 dark:text-amber-300">
							Falta la firma física
						</p>
						<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
							El certificado ya está emitido, pero el estudiante todavía no puede
							descargarlo. Imprimí la copia, hacela firmar y confirmá acá.
						</p>
						{#if canApprove(selectedRequest)}
							{#if selectedRequest.certificate_id}
								<Button
									size="sm"
									variant="secondary"
									class="mt-2"
									onclick={downloadCertPdf}
								>
									<DownloadIcon class="w-4 h-4 mr-1.5" />Descargar / imprimir certificado
								</Button>
							{/if}
							<label class="mt-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
								<input
									type="checkbox"
									bind:checked={confirmoImpresionCert}
									class="mt-0.5 size-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
								/>
								<span>
									Ya imprimí el certificado y lo tengo físicamente en mano para llevarlo a firmar.
								</span>
							</label>
							<input
								type="text"
								bind:value={observacionFirma}
								maxlength="500"
								placeholder="Nota opcional (ej. a quién se entregó la copia)"
								aria-label="Observación de la firma física"
								class="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-amber-700 dark:bg-dark-background dark:text-gray-100"
							/>
							<Button
								size="sm"
								class="mt-2"
								onclick={confirmarFirma}
								loading={actionInProgress}
								disabled={!confirmoImpresionCert}
							>
								<CircleCheckIcon class="w-4 h-4 mr-1.5" />Confirmar firma y habilitar descarga
							</Button>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Acciones -->
			<div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-dark-border">
				{#if selectedRequest.certificate_id}
					<Button variant="secondary" size="sm" onclick={downloadCertPdf}>
						<DownloadIcon class="w-4 h-4 mr-1.5" />Descargar PDF
					</Button>
				{/if}
				<Button variant="secondary" size="sm" onclick={closeDetail} disabled={actionInProgress}>
					Cerrar
				</Button>
				{#if canApprove(selectedRequest) && (selectedRequest.estado === 'pendiente' || selectedRequest.estado === 'en_revision')}
					{#if selectedRequest.tipo === 'no_deudor'}
						<!-- El tratamiento lo elige quien aprueba, no el estudiante:
						     es el que conoce el título real y el que firma. Arranca
						     vacío porque los de diplomado continuo no llevan. -->
						<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<span class="whitespace-nowrap">Tratamiento</span>
							<select
								bind:value={tratamientoElegido}
								class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-dark-border dark:bg-dark-background dark:text-gray-100"
							>
								<option value="">Sin tratamiento</option>
								{#each TRATAMIENTOS as t (t)}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</label>
					{/if}
					<Button
						variant="destructive"
						size="sm"
						onclick={openReject}
						disabled={actionInProgress}
					>
						<XIcon class="w-4 h-4 mr-1.5" />Rechazar
					</Button>
					<Button
						size="sm"
						onclick={approve}
						loading={actionInProgress}
					>
						<CircleCheckIcon class="w-4 h-4 mr-1.5" />Aprobar y emitir
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

<!-- Modal de rechazo -->
<Modal
	isOpen={rejectOpen}
	title="Rechazar Solicitud de Certificado"
	onClose={() => { if (!rejectLoading) rejectOpen = false; }}
	maxWidth="sm:max-w-lg"
>
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Indica el motivo del rechazo. El estudiante verá este mensaje y podrá crear una nueva
			solicitud.
		</p>
		<textarea
			bind:value={rejectMotivo}
			rows="4"
			class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
			placeholder="Ej: Aún no cumples los requisitos académicos para este certificado..."
		></textarea>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => (rejectOpen = false)} disabled={rejectLoading}>
				Cancelar
			</Button>
			<Button
				variant="destructive"
				onclick={confirmReject}
				loading={rejectLoading}
				disabled={rejectMotivo.trim().length < 5}
			>
				Rechazar Solicitud
			</Button>
		</div>
	</div>
</Modal>

<LibretaResumenModal
	isOpen={libretaOpen}
	enrollmentId={selectedRequest?.enrollment_id ?? null}
	onClose={() => (libretaOpen = false)}
/>
