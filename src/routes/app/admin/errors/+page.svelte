<script lang="ts">
	/**
	 * F-044 (2026-07-22) · Visor de Errores 500
	 * ===========================================
	 *
	 * Página que muestra los errores 500 capturados en producción
	 * (almacenados en MongoDB con TTL 7 días).
	 *
	 * Solo accesible para superadmin/admin.
	 */

	import { onMount } from 'svelte';
	import { adminService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type { ErrorLogItem, ErrorLogDetail, ErrorLogsListResponse } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';

	let loading = $state(true);
	let data: ErrorLogsListResponse | null = $state(null);
	let selectedError: ErrorLogDetail | null = $state(null);
	let loadingDetail = $state(false);

	// Filtros
	let hours = $state(24);
	let limit = $state(100);
	let pathFilter = $state('');

	// Solo superadmin/admin pueden ver esto
	const isAllowed = $derived(
		$userStore.user?.rol === 'superadmin' || $userStore.user?.rol === 'admin'
	);

	onMount(async () => {
		if (!isAllowed) {
			loading = false;
			return;
		}
		await load();
	});

	async function load() {
		loading = true;
		try {
			data = await adminService.getRecentErrors(hours, limit, undefined, pathFilter || undefined);
		} catch (error: any) {
			alert('error', error.message || 'Error al cargar el visor de errores');
		} finally {
			loading = false;
		}
	}

	async function viewDetail(errorId: string) {
		loadingDetail = true;
		try {
			selectedError = await adminService.getErrorDetail(errorId);
		} catch (error: any) {
			alert('error', error.message || 'Error al cargar el detalle');
		} finally {
			loadingDetail = false;
		}
	}

	function closeDetail() {
		selectedError = null;
	}

	function formatTimestamp(iso: string): string {
		try {
			const d = new Date(iso);
			return d.toLocaleString('es-BO', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			});
		} catch {
			return iso;
		}
	}

	function getMethodBadgeClass(method: string): string {
		const m = method.toUpperCase();
		if (m === 'GET') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
		if (m === 'POST') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		if (m === 'PATCH' || m === 'PUT')
			return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
		if (m === 'DELETE') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
		return 'bg-gray-100 text-gray-800';
	}

	function getStatusBadgeClass(status: number): string {
		if (status >= 500) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
		if (status >= 400) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
		return 'bg-green-100 text-green-800';
	}
</script>

<div class="space-y-6 max-w-7xl mx-auto">
	<div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
		<div>
			<Heading level="h1">Visor de Errores 500</Heading>
			<p class="text-gray-500 dark:text-gray-400 mt-1">
				Errores capturados en producción (últimas {hours}h, TTL 7 días)
			</p>
		</div>
	</div>

	{#if !isAllowed}
		<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-6 text-center">
			<p class="text-amber-800 dark:text-amber-200 font-medium">
				⚠️ Esta página solo está disponible para superadmin/admin.
			</p>
			<p class="text-sm text-amber-700 dark:text-amber-300 mt-2">
				Tu rol actual: <strong>{$userStore.user?.rol || 'desconocido'}</strong>
			</p>
		</div>
	{:else}
		<!-- Filtros -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
			<div class="flex flex-col md:flex-row gap-3 items-end">
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
						Ventana (horas)
					</label>
					<select
						bind:value={hours}
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
					>
						<option value={1}>Última 1h</option>
						<option value={6}>Últimas 6h</option>
						<option value={24}>Últimas 24h</option>
						<option value={72}>Últimos 3 días</option>
						<option value={168}>Últimos 7 días</option>
					</select>
				</div>
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
						Path contiene
					</label>
					<input
						type="text"
						bind:value={pathFilter}
						placeholder="ej: payments"
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
					/>
				</div>
				<Button variant="primary" onclick={load} loading={loading}>
					🔄 Refrescar
				</Button>
			</div>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
			</div>
		{:else if data && data.items.length === 0}
			<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6 text-center">
				<p class="text-green-800 dark:text-green-200 font-medium">
					✅ No se encontraron errores 500 en las últimas {hours} horas.
				</p>
			</div>
		{:else if data}
			<!-- Stats -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Total errores</p>
					<p class="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{data.total}</p>
				</div>
				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Tipos únicos</p>
					<p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
						{Object.keys(data.stats.by_type).length}
					</p>
				</div>
				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Paths afectados</p>
					<p class="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
						{data.stats.top_paths.length}
					</p>
				</div>
			</div>

			<!-- Top paths -->
			{#if data.stats.top_paths.length > 0}
				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
						🔥 Paths con más errores
					</h3>
					<div class="space-y-2">
						{#each data.stats.top_paths as tp}
							<div class="flex justify-between items-center text-sm">
								<code class="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
									{tp.path}
								</code>
								<span class="font-semibold text-red-600">{tp.count}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Tabla de errores -->
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Path</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Error</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
								<th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acción</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.items as err (err.id)}
								<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
										{formatTimestamp(err.timestamp)}
									</td>
									<td class="px-4 py-3">
										<span class={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${getMethodBadgeClass(err.method)}`}>
											{err.method}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(err.status_code)}`}>
											{err.status_code}
										</span>
									</td>
									<td class="px-4 py-3">
										<code class="text-xs text-gray-700 dark:text-gray-300">
											{err.path}
										</code>
									</td>
									<td class="px-4 py-3">
										<div class="text-sm">
											<p class="font-semibold text-red-600 dark:text-red-400">{err.error_type}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md" title={err.message}>
												{err.message}
											</p>
										</div>
									</td>
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
										{err.user_email || '—'}
									</td>
									<td class="px-4 py-3 text-right">
										<button
											onclick={() => viewDetail(err.id)}
											class="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
										>
											Ver detalle →
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Modal de detalle -->
{#if selectedError}
	<div
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">
					Detalle del error {selectedError.error_type}
				</h2>
				<button
					onclick={closeDetail}
					class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
				>
					✕
				</button>
			</div>
			<div class="overflow-y-auto p-6 space-y-4">
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<p class="text-xs text-gray-500 uppercase">Timestamp</p>
						<p>{formatTimestamp(selectedError.timestamp)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Status</p>
						<p class="font-bold text-red-600">{selectedError.status_code}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Method</p>
						<p>{selectedError.method}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Path</p>
						<code class="text-xs">{selectedError.path}</code>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">User</p>
						<p class="text-xs">
							{selectedError.user_email || '—'}
							{#if selectedError.user_type}
								<span class="text-gray-500">({selectedError.user_type})</span>
							{/if}
						</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Environment</p>
						<p>{selectedError.environment}</p>
					</div>
				</div>

				<div>
					<p class="text-xs text-gray-500 uppercase mb-1">Mensaje</p>
					<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{selectedError.message}</pre>
				</div>

				{#if selectedError.query_params}
					<div>
						<p class="text-xs text-gray-500 uppercase mb-1">Query params</p>
						<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{selectedError.query_params}</pre>
					</div>
				{/if}

				{#if selectedError.request_body}
					<div>
						<p class="text-xs text-gray-500 uppercase mb-1">Request body</p>
						<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{selectedError.request_body}</pre>
					</div>
				{/if}

				<div>
					<p class="text-xs text-gray-500 uppercase mb-1">Stack trace</p>
					<pre class="bg-gray-900 text-green-300 dark:bg-black p-3 rounded text-xs overflow-x-auto max-h-96">{selectedError.stack_trace || 'No disponible'}</pre>
				</div>
			</div>
		</div>
	</div>
{/if}
