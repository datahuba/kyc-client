<script lang="ts">
	import { onMount } from 'svelte';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { alert } from '$lib/utils';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';

	// ISSUE-R-SOLICITUD-INSCRIPCION
	interface EnrollmentRequest {
		_id: string;
		estudiante_id: string;
		curso_id: string;
		mensaje?: string | null;
		estado: string;
		motivo_rechazo?: string | null;
		revisado_por?: string | null;
		fecha_revision?: string | null;
		enrollment_id?: string | null;
		created_at: string;
		estudiante_nombre?: string | null;
		estudiante_registro?: string | null;
		curso_nombre?: string | null;
		curso_codigo?: string | null;
	}

	let requests = $state<EnrollmentRequest[]>([]);
	let loading = $state(true);
	let filtro = $state<'pendiente' | 'aprobado' | 'rechazado' | 'todas'>('pendiente');
	let processingId = $state<string | null>(null);

	// Modal de rechazo
	let rejectOpen = $state(false);
	let rejectTarget = $state<EnrollmentRequest | null>(null);
	let rejectMotivo = $state('');
	let rejectLoading = $state(false);

	async function loadRequests() {
		loading = true;
		try {
			const estadoParam = filtro === 'todas' ? '' : `&estado=${filtro}`;
			const res = await apiKyC.get<{ data: EnrollmentRequest[] }>(`/enrollment-requests/?page=1&per_page=100${estadoParam}`);
			requests = res.data || [];
		} catch (e: any) {
			alert('error', e?.message || 'No se pudieron cargar las solicitudes de inscripción');
		} finally {
			loading = false;
		}
	}

	function fmtDate(s: string) {
		if (!s) return '';
		let c = s.trim().replace(' ', 'T');
		if (c.includes('.')) c = c.split('.')[0];
		if (!c.endsWith('Z') && !c.includes('+')) c += 'Z';
		const d = new Date(c);
		return isNaN(d.getTime()) ? s : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	async function approve(req: EnrollmentRequest) {
		if (processingId) return;
		processingId = req._id;
		try {
			await apiKyC.post(`/enrollment-requests/${req._id}/approve`, {});
			alert('success', 'Solicitud aprobada. Se creó la inscripción del estudiante.');
			await loadRequests();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar la solicitud');
		} finally {
			processingId = null;
		}
	}

	function openReject(req: EnrollmentRequest) {
		rejectTarget = req;
		rejectMotivo = '';
		rejectOpen = true;
	}

	async function confirmReject() {
		if (!rejectTarget || rejectMotivo.trim().length < 3) return;
		rejectLoading = true;
		try {
			await apiKyC.post(`/enrollment-requests/${rejectTarget._id}/reject`, { motivo: rejectMotivo.trim() });
			alert('success', 'Solicitud rechazada');
			rejectOpen = false;
			rejectTarget = null;
			await loadRequests();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo rechazar la solicitud');
		} finally {
			rejectLoading = false;
		}
	}

	function estadoBadge(estado: string) {
		if (estado === 'pendiente') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
		if (estado === 'aprobado') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
		return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
	}

	onMount(loadRequests);
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<Heading level="h1">Solicitudes de Inscripción</Heading>
		<div class="flex gap-2 flex-wrap">
			{#each ['pendiente', 'aprobado', 'rechazado', 'todas'] as f}
				<button
					type="button"
					onclick={() => { filtro = f as any; loadRequests(); }}
					class={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${filtro === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-dark-surface dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border'}`}
				>
					{f}
				</button>
			{/each}
		</div>
	</div>

	<p class="text-sm text-gray-500 dark:text-gray-400">
		Solicitudes de estudiantes para cursar un programa activo. Al aprobar se crea la inscripción real
		(con matrícula, módulos y descuentos calculados automáticamente).
	</p>

	{#if loading}
		<div class="flex justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
	{:else if requests.length === 0}
		<div class="text-center py-12 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl">
			<p class="text-gray-500 dark:text-gray-400">No hay solicitudes {filtro !== 'todas' ? filtro + 's' : ''}.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each requests as req (req._id)}
				<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-sm p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h3 class="text-sm font-bold text-gray-900 dark:text-white truncate" title={req.estudiante_nombre || req.estudiante_id}>
								{req.estudiante_nombre || 'Estudiante'} {#if req.estudiante_registro}<span class="text-gray-400 font-normal">· {req.estudiante_registro}</span>{/if}
							</h3>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate" title={req.curso_nombre || req.curso_id}>
								{req.curso_nombre || 'Curso'} {#if req.curso_codigo}<span class="text-gray-400">({req.curso_codigo})</span>{/if}
							</p>
						</div>
						<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadge(req.estado)}`}>{req.estado}</span>
					</div>

					{#if req.mensaje}
						<p class="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2">
							<span class="font-semibold text-gray-700 dark:text-gray-300">Comentario:</span> {req.mensaje}
						</p>
					{/if}

					{#if req.estado === 'rechazado' && req.motivo_rechazo}
						<p class="mt-2 text-xs text-light-error bg-red-50 dark:bg-red-950/20 rounded-lg p-2">Motivo del rechazo: {req.motivo_rechazo}</p>
					{/if}

					<div class="mt-3 flex items-center justify-between">
						<span class="text-[11px] text-gray-400 dark:text-gray-500">{fmtDate(req.created_at)}</span>
						{#if req.estado === 'pendiente'}
							<div class="flex gap-2">
								<Button variant="destructive" size="sm" onclick={() => openReject(req)} disabled={processingId === req._id}>Rechazar</Button>
								<Button size="sm" onclick={() => approve(req)} loading={processingId === req._id}>Aprobar</Button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal de rechazo -->
<Modal isOpen={rejectOpen} title="Rechazar Solicitud de Inscripción" onClose={() => { if (!rejectLoading) rejectOpen = false; }} maxWidth="sm:max-w-lg">
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Indica el motivo del rechazo de esta solicitud.
		</p>
		<textarea
			bind:value={rejectMotivo}
			rows="3"
			class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-red-500"
			placeholder="Ej: El curso ya alcanzó el cupo máximo..."
		></textarea>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => rejectOpen = false} disabled={rejectLoading}>Cancelar</Button>
			<Button variant="destructive" onclick={confirmReject} loading={rejectLoading} disabled={rejectMotivo.trim().length < 3}>Rechazar Solicitud</Button>
		</div>
	</div>
</Modal>
