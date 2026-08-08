<script lang="ts">
	/**
	 * /app/data-health — Reporte consolidado de inconsistencias de datos
	 *
	 * R35-FASE-3 (2026-08-07, Kevin): vista única para que el superadmin
	 * vea de un vistazo TODAS las inconsistencias detectadas por los
	 * 14 checks del backend.
	 *
	 * - Solo superadmin (verificado en backend con require_superadmin)
	 * - KPIs arriba (total + por severidad)
	 * - Lista plana con modal de detalle al hacer click
	 * - Filtros: programa, tipo, severidad
	 * - Acciones masivas con confirmacion previa
	 * - Refresh automatico cada 30s
	 * - Exportar a CSV
	 */

	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		ExclamationIcon,
		CheckIcon,
		DownloadIcon,
		RefreshIcon,
		SearchIcon,
		XIcon
	} from '$lib/icons/outline';

	import { userStore } from '$lib/stores/userStore';
	import { dataHealthService } from '$lib/services/dataHealth.service';
	import { alert } from '$lib/utils';
	import type {
		DataHealthResponse,
		DataHealthInconsistencia,
		DataHealthKPIs
	} from '$lib/interfaces/dataHealth.interface';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';

	// ========================================================================
	// STATE
	// ========================================================================

	let loading = $state(true);
	let data = $state<DataHealthResponse | null>(null);
	let error = $state<string | null>(null);
	let refreshTimer: ReturnType<typeof setInterval> | null = null;

	// Filtros
	let filtroPrograma = $state<string>('');
	let filtroTipo = $state<string>('');
	let filtroSeveridad = $state<string>('');
	let busqueda = $state<string>('');

	// Modal de detalle
	let detailOpen = $state(false);
	let selectedItem = $state<DataHealthInconsistencia | null>(null);
	let actionInProgress = $state(false);

	// Modal de confirmacion de accion
	let confirmOpen = $state(false);
	let confirmAction = $state<string>('');
	let confirmMessage = $state<string>('');
	let confirmPayload = $state<any>(null);

	// ========================================================================
	// COMPUTED
	// ========================================================================

	const inconsistenciasFiltradas = $derived.by(() => {
		if (!data?.inconsistencias) return [];
		let items = [...data.inconsistencias];
		if (filtroPrograma) items = items.filter(i => i.programa_id === filtroPrograma);
		if (filtroTipo) items = items.filter(i => i.tipo === filtroTipo);
		if (filtroSeveridad) items = items.filter(i => i.severidad === filtroSeveridad);
		if (busqueda) {
			const q = busqueda.toLowerCase();
			items = items.filter(i =>
				(i.estudiante_nombre || '').toLowerCase().includes(q) ||
				(i.programa_codigo || '').toLowerCase().includes(q) ||
				(i.descripcion || '').toLowerCase().includes(q)
			);
		}
		return items;
	});

	const isSuperadmin = $derived.by(() => {
		const u: any = $userStore?.user;
		return u?.rol === 'superadmin' || u?.role === 'superadmin';
	});

	// ========================================================================
	// METHODS
	// ========================================================================

	async function loadData() {
		if (!browser) return;
		loading = true;
		error = null;
		try {
			const params: Record<string, string> = {};
			if (filtroPrograma) params['programa_id'] = filtroPrograma;
			if (filtroTipo) params['tipo'] = filtroTipo;
			if (filtroSeveridad) params['severidad'] = filtroSeveridad;
			console.log('[data-health] loadData START, isSuperadmin=', isSuperadmin);
			const result = await dataHealthService.getDataHealth(params);
			console.log('[data-health] loadData GOT result=', typeof result, 'keys=', result ? Object.keys(result) : 'N/A', 'inconsistencias count=', result?.inconsistencias?.length, 'isNull=', result === null, 'isUndefined=', result === undefined);
			data = result;
			console.log('[data-health] loadData DONE, data is now=', data ? 'set with ' + data.inconsistencias?.length : 'null');
		} catch (e: any) {
			error = e?.message || 'Error cargando reporte';
			console.error('[data-health] ERROR', e);
		} finally {
			loading = false;
		}
	}

	async function applyAccion(accion: string, payload: any) {
		actionInProgress = true;
		try {
			const res = await dataHealthService.fixInconsistencia(accion, payload);
			if (res.ok) {
				alert('success', res.message);
				// Recargar data
				await loadData();
			} else {
				alert('error', res.message || 'Error aplicando accion');
			}
		} catch (e: any) {
			alert('error', e?.response?.data?.detail || e?.message || 'Error');
		} finally {
			actionInProgress = false;
			confirmOpen = false;
		}
	}

	function openConfirmAccion(accion: string, item: DataHealthInconsistencia) {
		selectedItem = item;
		confirmAction = accion;
		// Mensaje human-readable
		const mensajes: Record<string, string> = {
			cambiar_a_activo: `Cambiar enrollment a ACTIVO?\n\nEstudiante: ${item.estudiante_nombre}\nPrograma: ${item.programa_codigo}\n\nEsta accion cambiara el estado a ACTIVO.`,
			reclasificar: `Reclasificar el estado del estudiante?\n\nEstudiante: ${item.estudiante_nombre}\nNuevo motivo: ${item.metadata?.motivo || 'congelado'}`,
			marcar_cumple: `Marcar requisito como cumplido?\n\nRequisito: ${item.metadata?.requisito}\nEstudiante: ${item.estudiante_nombre}`,
			anular_duplicados: `Anular pagos duplicados?\n\n${item.metadata?.count} pagos, total Bs ${item.monto}\nSe mantendra el primero, se anularan los ${(item.metadata?.count || 1) - 1} restantes.`,
			decidir_historico_o_activo: `Este programa esta marcado como historico pero esta en_ejecucion.\n\nPrograma: ${item.programa_codigo}\nInscritos: ${item.metadata?.inscritos || 0}\n\nDecide:\n- marcar_historico: confirma que es historico (excluir del alcance)\n- marcar_activo: confirma que esta activo (incluir en alcance)`,
			corregir_porcentaje: `Corregir porcentaje del descuento?\n\nDescuento: ${item.programa_codigo}\nPorcentaje actual: ${item.metadata?.porcentaje}% (fuera de 0-100)`,
			verificar_pagos_beca: `Recalcular saldo del becado?\n\nEstudiante: ${item.estudiante_nombre}\nSaldo actual: Bs ${item.metadata?.saldo}\nEsto recalculara el total_pagado y saldo_pendiente.`,
			subir_resolucion: 'Use el boton "Subir Resolucion" en la pagina del programa.',
			reasignar_encargado: 'Use la pagina del programa para reasignar encargados.'
		};
		confirmMessage = mensajes[accion] || 'Aplicar accion?';
		confirmOpen = true;
	}

	function executeAccion() {
		if (!confirmAction || !selectedItem) return;
		const payload: any = {
			entidad_id: selectedItem.entidad_id,
			metadata: selectedItem.metadata || {}
		};
		// Para decidir_historico_o_activo
		if (confirmAction === 'decidir_historico_o_activo') {
			payload.decision = prompt('decision? (marcar_historico o marcar_activo):') || 'marcar_activo';
		}
		// Para reclasificar
		if (confirmAction === 'reclasificar') {
			payload.motivo = 'congelado';
		}
		// Para corregir_porcentaje
		if (confirmAction === 'corregir_porcentaje') {
			const nuevo = prompt(`Nuevo porcentaje (0-100). Actual: ${selectedItem.metadata?.porcentaje}%:`, '50');
			const n = parseFloat(nuevo || '');
			if (isNaN(n) || n < 0 || n > 100) {
				alert('error', 'Porcentaje invalido');
				return;
			}
			payload.porcentaje = n;
		}
		applyAccion(confirmAction, payload);
	}

	function openDetail(item: DataHealthInconsistencia) {
		selectedItem = item;
		detailOpen = true;
	}

	function exportCSV() {
		if (!data?.inconsistencias) return;
		const headers = ['severidad', 'tipo', 'estudiante_nombre', 'programa_codigo', 'descripcion', 'entidad_id', 'accion_sugerida'];
		const rows = inconsistenciasFiltradas.map(i => [
			i.severidad,
			i.tipo,
			(i.estudiante_nombre || '').replace(/,/g, ' '),
			(i.programa_codigo || '').replace(/,/g, ' '),
			(i.descripcion || '').replace(/,/g, ' ').replace(/\n/g, ' '),
			i.entidad_id || '',
			i.accion_sugerida || ''
		]);
		const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `data-health-${new Date().toISOString().split('T')[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function getSeverityColor(sev: string): string {
		switch (sev) {
			case 'critica': return 'bg-red-100 text-red-800 border-red-300';
			case 'alta': return 'bg-orange-100 text-orange-800 border-orange-300';
			case 'media': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
			case 'baja': return 'bg-blue-100 text-blue-800 border-blue-300';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	function getSeverityIcon(sev: string): string {
		switch (sev) {
			case 'critica':
			case 'alta': return '🔴';
			case 'media': return '🟡';
			case 'baja': return '🔵';
			default: return '⚪';
		}
	}

	// ========================================================================
	// LIFECYCLE
	// ========================================================================

	onMount(async () => {
		console.log('[data-health] onMount, isSuperadmin=', isSuperadmin, 'userStore=', $userStore);
		if (!isSuperadmin) {
			error = 'Solo superadmin puede ver este reporte';
			loading = false;
			return;
		}
		await loadData();
		// Refresh cada 30s
		refreshTimer = setInterval(() => {
			if (!actionInProgress) loadData();
		}, 30000);
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});

	$effect(() => {
		// Recargar cuando cambian los filtros
		if (browser && data) {
			loadData();
		}
	});
</script>

<div class="space-y-6 p-4 sm:p-6 lg:p-8">
	<!-- HEADER -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<Heading level="h2">Reporte de Salud de Datos</Heading>
			<p class="text-sm text-gray-500 mt-1">
				Inconsistencias detectadas en programas en ejecucion. Refresh automatico cada 30s.
				Ultima actualizacion: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'}
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="secondary" onclick={loadData} disabled={loading}>
				<RefreshIcon class="h-4 w-4 mr-1" />
				Actualizar
			</Button>
			<Button variant="secondary" onclick={exportCSV} disabled={!data?.inconsistencias?.length}>
				<DownloadIcon class="h-4 w-4 mr-1" />
				Exportar CSV
			</Button>
		</div>
	</div>

	<!-- AUTH CHECK -->
	{#if !isSuperadmin}
		<Card>
			<div class="p-6 text-center">
				<ExclamationIcon class="h-12 w-12 text-red-500 mx-auto" />
				<h3 class="mt-2 text-lg font-semibold">Acceso restringido</h3>
				<p class="text-gray-600">Solo superadmin puede ver el reporte consolidado de inconsistencias.</p>
			</div>
		</Card>
	{:else if error}
		<Card>
			<div class="p-6 text-center text-red-600">
				<ExclamationIcon class="h-12 w-12 mx-auto" />
				<p class="mt-2">{error}</p>
				<Button variant="secondary" onclick={loadData} class="mt-3">Reintentar</Button>
			</div>
		</Card>
	{:else if loading && !data}
		<div class="space-y-4">
			<Skeleton class="h-24 w-full" />
			<Skeleton class="h-96 w-full" />
		</div>
	{:else if data}
		<!-- KPIs -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			<Card>
				<div class="p-4">
					<div class="text-3xl font-bold text-red-600">{data.kpis.criticas || 0}</div>
					<div class="text-sm text-gray-500">Criticas</div>
				</div>
			</Card>
			<Card>
				<div class="p-4">
					<div class="text-3xl font-bold text-orange-600">{data.kpis.altas || 0}</div>
					<div class="text-sm text-gray-500">Altas</div>
				</div>
			</Card>
			<Card>
				<div class="p-4">
					<div class="text-3xl font-bold text-yellow-600">{data.kpis.medias || 0}</div>
					<div class="text-sm text-gray-500">Medias</div>
				</div>
			</Card>
			<Card>
				<div class="p-4">
					<div class="text-3xl font-bold text-gray-700">{data.kpis.bajas || 0}</div>
					<div class="text-sm text-gray-500">Bajas</div>
				</div>
			</Card>
		</div>

		<!-- PROGRAMS + CHECKS INFO -->
		<Card>
			<div class="p-4 text-sm text-gray-600 flex flex-wrap gap-4">
				<span><b>{data.programas_evaluados}</b> programas evaluados</span>
				<span><b>{data.checks_ejecutados}</b> checks ejecutados</span>
				<span><b>{inconsistenciasFiltradas.length}</b> inconsistencias (filtradas)</span>
				<span><b>{data.inconsistencias.length}</b> total</span>
			</div>
		</Card>

		<!-- FILTROS -->
		<Card>
			<div class="p-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
				<div>
					<label class="text-xs text-gray-500">Programa</label>
					<select bind:value={filtroPrograma} class="w-full rounded border p-2 text-sm">
						<option value="">Todos ({data.filtros.programas.length})</option>
						{#each data.filtros.programas as p}
							<option value={p.id}>{p.codigo} ({p.inscritos} inscr.)</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="text-xs text-gray-500">Tipo</label>
					<select bind:value={filtroTipo} class="w-full rounded border p-2 text-sm">
						<option value="">Todos ({data.filtros.tipos.length})</option>
						{#each data.filtros.tipos as t}
							<option value={t.tipo}>{getSeverityIcon(t.severidad)} {t.titulo}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="text-xs text-gray-500">Severidad</label>
					<select bind:value={filtroSeveridad} class="w-full rounded border p-2 text-sm">
						<option value="">Todas</option>
						{#each data.filtros.severidades as s}
							<option value={s}>{getSeverityIcon(s)} {s}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="text-xs text-gray-500">Buscar</label>
					<input
						type="text"
						bind:value={busqueda}
						placeholder="estudiante, programa, texto..."
						class="w-full rounded border p-2 text-sm"
					/>
				</div>
			</div>
		</Card>

		<!-- LISTA DE INCONSISTENCIAS -->
		{#if inconsistenciasFiltradas.length === 0}
			<EmptyState title="Sin inconsistencias" description="No hay inconsistencias con los filtros aplicados" />
		{:else}
			<Card>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Sev</th>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Estudiante</th>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Programa</th>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Descripcion</th>
								<th class="px-3 py-2 text-left font-medium text-gray-700">Accion</th>
							</tr>
						</thead>
						<tbody>
							{#each inconsistenciasFiltradas as item}
								<tr
									class="border-t hover:bg-gray-50 cursor-pointer"
									onclick={() => openDetail(item)}
								>
									<td class="px-3 py-2">
										<span class="inline-block px-2 py-0.5 rounded text-xs font-medium border {getSeverityColor(item.severidad)}">
											{item.severidad}
										</span>
									</td>
									<td class="px-3 py-2 text-xs">{item.tipo}</td>
									<td class="px-3 py-2">{item.estudiante_nombre || '-'}</td>
									<td class="px-3 py-2 text-xs">{item.programa_codigo || '-'}</td>
									<td class="px-3 py-2 text-xs max-w-md truncate">{item.descripcion}</td>
									<td class="px-3 py-2 text-xs">
										{#if item.accion_sugerida}
											<button
												class="text-blue-600 hover:underline"
												onclick={(e) => { e.stopPropagation(); openConfirmAccion(item.accion_sugerida, item); }}
											>
												{item.accion_sugerida}
											</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if inconsistenciasFiltradas.length > 200}
						<div class="p-3 text-center text-xs text-gray-500">
							Mostrando {inconsistenciasFiltradas.length} inconsistencias. Usa los filtros para reducir o Exportar CSV.
						</div>
					{/if}
				</div>
			</Card>
		{/if}
	{/if}
</div>

<!-- MODAL DE DETALLE -->
{#if detailOpen && selectedItem}
	<Modal open={detailOpen} onClose={() => detailOpen = false} title="Detalle de inconsistencia">
		<div class="p-4 space-y-3">
			<div class="flex items-center gap-2">
				<span class="px-3 py-1 rounded font-medium border {getSeverityColor(selectedItem.severidad)}">
					{selectedItem.severidad}
				</span>
				<span class="text-sm text-gray-500">{selectedItem.tipo}</span>
			</div>
			<div>
				<div class="text-xs text-gray-500">Descripcion</div>
				<div class="text-sm">{selectedItem.descripcion}</div>
			</div>
			{#if selectedItem.estudiante_nombre}
				<div>
					<div class="text-xs text-gray-500">Estudiante</div>
					<div class="text-sm">{selectedItem.estudiante_nombre}</div>
				</div>
			{/if}
			{#if selectedItem.programa_codigo}
				<div>
					<div class="text-xs text-gray-500">Programa</div>
					<div class="text-sm">{selectedItem.programa_codigo}</div>
				</div>
			{/if}
			<div>
				<div class="text-xs text-gray-500">ID entidad</div>
				<div class="text-xs font-mono">{selectedItem.entidad_id}</div>
			</div>
			{#if selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0}
				<div>
					<div class="text-xs text-gray-500">Metadata</div>
					<pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(selectedItem.metadata, null, 2)}</pre>
				</div>
			{/if}
			{#if selectedItem.accion_sugerida}
				<div class="pt-2 border-t">
					<Button
						onclick={() => { detailOpen = false; openConfirmAccion(selectedItem.accion_sugerida, selectedItem); }}
						disabled={actionInProgress}
					>
						Aplicar: {selectedItem.accion_sugerida}
					</Button>
				</div>
			{/if}
		</div>
	</Modal>
{/if}

<!-- MODAL DE CONFIRMACION -->
{#if confirmOpen && selectedItem}
	<Modal open={confirmOpen} onClose={() => confirmOpen = false} title="Confirmar accion">
		<div class="p-4 space-y-4">
			<div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm whitespace-pre-line">
				{confirmMessage}
			</div>
			<div class="flex justify-end gap-2">
				<Button variant="secondary" onclick={() => confirmOpen = false} disabled={actionInProgress}>
					Cancelar
				</Button>
				<Button onclick={executeAccion} disabled={actionInProgress}>
					{actionInProgress ? 'Aplicando...' : 'Confirmar y aplicar'}
				</Button>
			</div>
		</div>
	</Modal>
{/if}
