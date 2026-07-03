<script lang="ts">
	import { onMount } from 'svelte';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { alert } from '$lib/utils';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';

	interface AccountRequest {
		_id: string;
		nombre: string;
		email: string;
		carnet: string;
		celular?: string | null;
		registro?: string | null;
		es_estudiante_interno: string;
		mensaje?: string | null;
		estado: string;
		motivo_rechazo?: string | null;
		created_at: string;
	}

	let requests = $state<AccountRequest[]>([]);
	let loading = $state(true);
	let filtro = $state<'pendiente' | 'aprobado' | 'rechazado' | 'todas'>('pendiente');
	let processingId = $state<string | null>(null);

	// Modal de rechazo
	let rejectOpen = $state(false);
	let rejectTarget = $state<AccountRequest | null>(null);
	let rejectMotivo = $state('');
	let rejectLoading = $state(false);

	async function loadRequests() {
		loading = true;
		try {
			const estadoParam = filtro === 'todas' ? '' : `&estado=${filtro}`;
			const res = await apiKyC.get<{ data: AccountRequest[] }>(`/account-requests/?page=1&per_page=100${estadoParam}`);
			requests = res.data || [];
		} catch (e: any) {
			alert('error', e?.message || 'No se pudieron cargar las solicitudes');
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

	async function approve(req: AccountRequest) {
		if (processingId) return;
		processingId = req._id;
		try {
			await apiKyC.post(`/account-requests/${req._id}/approve`, {});
			alert('success', `Cuenta de ${req.nombre} creada. Contraseña inicial: su carnet.`);
			await loadRequests();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar la solicitud');
		} finally {
			processingId = null;
		}
	}

	function openReject(req: AccountRequest) {
		rejectTarget = req;
		rejectMotivo = '';
		rejectOpen = true;
	}

	async function confirmReject() {
		if (!rejectTarget || rejectMotivo.trim().length < 3) return;
		rejectLoading = true;
		try {
			await apiKyC.post(`/account-requests/${rejectTarget._id}/reject`, { motivo: rejectMotivo.trim() });
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
		<Heading level="h1">Solicitudes de Cuenta</Heading>
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
							<h3 class="text-sm font-bold text-gray-900 dark:text-white truncate">{req.nombre}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{req.email}</p>
						</div>
						<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadge(req.estado)}`}>{req.estado}</span>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
						<div><span class="text-gray-400 dark:text-gray-500">CI:</span> <span class="text-gray-800 dark:text-gray-200 font-medium">{req.carnet}</span></div>
						<div><span class="text-gray-400 dark:text-gray-500">Tipo:</span> <span class="text-gray-800 dark:text-gray-200 font-medium capitalize">{req.es_estudiante_interno}</span></div>
						<div><span class="text-gray-400 dark:text-gray-500">Celular:</span> <span class="text-gray-800 dark:text-gray-200 font-medium">{req.celular || '—'}</span></div>
						<div><span class="text-gray-400 dark:text-gray-500">Registro:</span> <span class="text-gray-800 dark:text-gray-200 font-medium">{req.registro || '—'}</span></div>
					</div>

					{#if req.mensaje}
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2">{req.mensaje}</p>
					{/if}
					{#if req.estado === 'rechazado' && req.motivo_rechazo}
						<p class="mt-2 text-xs text-light-error bg-red-50 dark:bg-red-950/20 rounded-lg p-2">Motivo: {req.motivo_rechazo}</p>
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
<Modal isOpen={rejectOpen} title="Rechazar Solicitud" onClose={() => { if (!rejectLoading) rejectOpen = false; }} maxWidth="sm:max-w-lg">
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Indica el motivo del rechazo de la solicitud de <span class="font-semibold text-gray-800 dark:text-gray-200">{rejectTarget?.nombre}</span>.
		</p>
		<textarea
			bind:value={rejectMotivo}
			rows="3"
			class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-red-500"
			placeholder="Ej: Datos incompletos o incorrectos..."
		></textarea>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => rejectOpen = false} disabled={rejectLoading}>Cancelar</Button>
			<Button variant="destructive" onclick={confirmReject} loading={rejectLoading} disabled={rejectMotivo.trim().length < 3}>Rechazar Solicitud</Button>
		</div>
	</div>
</Modal>
