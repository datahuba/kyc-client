<script lang="ts">
	import { onMount } from 'svelte';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { alert } from '$lib/utils';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';

	// ISSUE-R-SOLICITUD-PASIVO
	interface PassiveRequest {
		_id: string;
		enrollment_id: string;
		solicitante_id: string;
		solicitante_tipo: string;
		motivo: string;
		respaldo_url?: string | null;
		estado: string;
		motivo_rechazo?: string | null;
		revisado_por?: string | null;
		fecha_revision?: string | null;
		created_at: string;
	}

	let requests = $state<PassiveRequest[]>([]);
	let loading = $state(true);
	let filtro = $state<'pendiente' | 'aprobado' | 'rechazado' | 'todas'>('pendiente');
	let processingId = $state<string | null>(null);

	// Modal de rechazo
	let rejectOpen = $state(false);
	let rejectTarget = $state<PassiveRequest | null>(null);
	let rejectMotivo = $state('');
	let rejectLoading = $state(false);

	async function loadRequests() {
		loading = true;
		try {
			const estadoParam = filtro === 'todas' ? '' : `&estado=${filtro}`;
			const res = await apiKyC.get<{ data: PassiveRequest[] }>(`/passive-requests/?page=1&per_page=100${estadoParam}`);
			requests = res.data || [];
		} catch (e: any) {
			alert('error', e?.message || 'No se pudieron cargar las solicitudes de pasivo');
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

	async function approve(req: PassiveRequest) {
		if (processingId) return;
		processingId = req._id;
		try {
			await apiKyC.post(`/passive-requests/${req._id}/approve`, {});
			alert('success', 'Solicitud aprobada. La inscripción quedó en estado pasivo.');
			await loadRequests();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar la solicitud');
		} finally {
			processingId = null;
		}
	}

	function openReject(req: PassiveRequest) {
		rejectTarget = req;
		rejectMotivo = '';
		rejectOpen = true;
	}

	async function confirmReject() {
		if (!rejectTarget || rejectMotivo.trim().length < 3) return;
		rejectLoading = true;
		try {
			await apiKyC.post(`/passive-requests/${rejectTarget._id}/reject`, { motivo: rejectMotivo.trim() });
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

	function solicitanteBadge(tipo: string) {
		return tipo === 'student'
			? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
			: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
	}

	onMount(loadRequests);
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<Heading level="h1">Solicitudes de Estado Pasivo</Heading>
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
		Solicitudes para pausar (congelar) una inscripción sin perder el historial ni los pagos.
		El curso puede reactivarse más adelante desde el módulo de Inscripciones.
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
							<h3 class="text-sm font-bold text-gray-900 dark:text-white">Inscripción {req.enrollment_id.slice(-6)}</h3>
							<span class={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${solicitanteBadge(req.solicitante_tipo)}`}>
								{req.solicitante_tipo === 'student' ? 'Solicitado por el estudiante' : 'Solicitado por staff'}
							</span>
						</div>
						<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadge(req.estado)}`}>{req.estado}</span>
					</div>

					<p class="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2">
						<span class="font-semibold text-gray-700 dark:text-gray-300">Motivo:</span> {req.motivo}
					</p>

					{#if req.respaldo_url}
						<a href={req.respaldo_url} target="_blank" rel="noopener noreferrer" class="mt-2 inline-block text-xs text-primary-600 dark:text-primary-400 hover:underline">
							Ver documento de respaldo
						</a>
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
<Modal isOpen={rejectOpen} title="Rechazar Solicitud de Pasivo" onClose={() => { if (!rejectLoading) rejectOpen = false; }} maxWidth="sm:max-w-lg">
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Indica el motivo del rechazo de esta solicitud.
		</p>
		<textarea
			bind:value={rejectMotivo}
			rows="3"
			class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-red-500"
			placeholder="Ej: No corresponde congelar el curso en este momento..."
		></textarea>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => rejectOpen = false} disabled={rejectLoading}>Cancelar</Button>
			<Button variant="destructive" onclick={confirmReject} loading={rejectLoading} disabled={rejectMotivo.trim().length < 3}>Rechazar Solicitud</Button>
		</div>
	</div>
</Modal>
