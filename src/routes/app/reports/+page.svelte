<script lang="ts">
	// ISSUE-P-REPORTE: tabla interactiva de ingresos por fecha real del pago,
	// curso y estado, exportable a Excel. Reutiliza el mismo filtro de
	// segmentación de Cobranza por curso ya aplicado en /app/payments.
	import { onMount } from 'svelte';
	import { paymentService, courseService } from '$lib/services';
	import type { ReporteCajaResumen } from '$lib/services/payment.service';
	import type { Payment, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { Pagination } from '$lib/components/ui';
	import { DownloadIcon, RefreshIcon } from '$lib/icons/outline';
	import { alert, formatDate, formatCurrency } from '$lib/utils';

	function hoyISO(): string {
		return new Date().toISOString().slice(0, 10);
	}

	let payments: Payment[] = $state([]);
	let resumen: ReporteCajaResumen = $state({
		cantidad_pagos: 0,
		total_aprobado: 0,
		total_pendiente: 0,
		total_anulado: 0
	});
	let coursesList: Course[] = $state([]);
	let coursesMap: Record<string, Course> = $state({});
	let loading = $state(false);
	let exporting = $state(false);

	let page = $state(1);
	let limit = $state(20);
	let totalItems = $state(0);
	let totalPages = $state(1);

	let filters = $state({
		fecha_desde: hoyISO(),
		fecha_hasta: hoyISO(),
		curso_id: '',
		estado: ''
	});

	// ISSUE-P-SEGMENTACION: si el usuario (Cobranza) tiene cursos_asignados,
	// el selector de curso solo debe mostrar esos cursos.
	let cursosAsignadosUsuario = $derived($userStore.user?.cursos_asignados ?? []);
	let coursesListFiltrada = $derived(
		cursosAsignadosUsuario.length > 0
			? coursesList.filter((c) => cursosAsignadosUsuario.includes(c._id))
			: coursesList
	);
	let isCobranza = $derived($userStore.role === 'cobranza');

	onMount(async () => {
		try {
			const res = await courseService.getAll(1, 100);
			coursesList = res.data;
			const map: Record<string, Course> = {};
			for (const c of res.data) map[c._id] = c;
			coursesMap = map;
		} catch (e) {
			console.error('Error cargando cursos para el reporte', e);
		}
		await loadReporte();
	});

	async function loadReporte() {
		if (!filters.fecha_desde || !filters.fecha_hasta) {
			alert('error', 'Selecciona un rango de fechas válido.');
			return;
		}
		if (filters.fecha_desde > filters.fecha_hasta) {
			alert('error', 'La fecha de inicio no puede ser posterior a la fecha final.');
			return;
		}
		loading = true;
		try {
			const res = await paymentService.getReporteCaja(page, limit, {
				fecha_desde: filters.fecha_desde,
				fecha_hasta: filters.fecha_hasta,
				curso_id: filters.curso_id || undefined,
				estado: filters.estado || undefined
			});
			payments = res.data;
			resumen = res.resumen;
			totalItems = res.meta.totalItems;
			totalPages = res.meta.totalPages;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo generar el reporte');
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadReporte();
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadReporte();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadReporte();
	}

	async function handleExportExcel() {
		exporting = true;
		try {
			await paymentService.downloadReporteCajaExcel({
				fecha_desde: filters.fecha_desde,
				fecha_hasta: filters.fecha_hasta,
				curso_id: filters.curso_id || undefined,
				estado: filters.estado || undefined
			});
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo generar el archivo Excel');
		} finally {
			exporting = false;
		}
	}

	function getCursoNombre(id: string): string {
		return coursesMap[id]?.nombre_programa || 'Curso desconocido';
	}

	function getStatusColor(estado: string) {
		switch (estado) {
			case 'aprobado': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
			case 'pendiente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'rechazado': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
			case 'anulado': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Reportes de Caja</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Ingresos filtrados por la fecha real del pago (comprobante), curso y estado.
			</p>
			{#if isCobranza && cursosAsignadosUsuario.length > 0}
				<p class="mt-1 text-xs font-medium text-uagrm-sky">
					Vista segmentada: solo se muestran pagos de los {cursosAsignadosUsuario.length} curso(s) asignado(s) a tu cuenta.
				</p>
			{/if}
		</div>
		<div class="flex gap-3">
			<Button variant="secondary" onclick={loadReporte} loading={loading}>
				{#snippet leftIcon()}<RefreshIcon class="size-5" />{/snippet}
			</Button>
			<Button onclick={handleExportExcel} loading={exporting}>
				{#snippet leftIcon()}<DownloadIcon class="size-5" />{/snippet}
				Exportar Excel
			</Button>
		</div>
	</div>

	<!-- Filtros -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border">
		<Input label="Desde" id="fecha_desde" type="date" bind:value={filters.fecha_desde} onchange={handleFilterChange} />
		<Input label="Hasta" id="fecha_hasta" type="date" bind:value={filters.fecha_hasta} onchange={handleFilterChange} />
		<Select label="Curso" bind:value={filters.curso_id} onchange={handleFilterChange}>
			<option value="">Todos los cursos</option>
			{#each coursesListFiltrada as course (course._id)}
				<option value={course._id}>{course.nombre_programa}</option>
			{/each}
		</Select>
		<Select label="Estado" bind:value={filters.estado} onchange={handleFilterChange}>
			<option value="">Todos los estados</option>
			<option value="pendiente">Pendiente</option>
			<option value="aprobado">Aprobado</option>
			<option value="rechazado">Rechazado</option>
			<option value="anulado">Anulado</option>
		</Select>
	</div>

	<!-- Resumen agregado -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card variant="bordered" padding="md">
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cantidad de Pagos</p>
			<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{resumen.cantidad_pagos}</p>
		</Card>
		<Card variant="bordered" padding="md">
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Aprobado</p>
			<p class="mt-1 text-2xl font-bold text-light-success dark:text-dark-success">{formatCurrency(resumen.total_aprobado)}</p>
		</Card>
		<Card variant="bordered" padding="md">
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Pendiente</p>
			<p class="mt-1 text-2xl font-bold text-light-warning dark:text-dark-warning">{formatCurrency(resumen.total_pendiente)}</p>
		</Card>
		<Card variant="bordered" padding="md">
			<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Anulado</p>
			<p class="mt-1 text-2xl font-bold text-light-error dark:text-dark-error">{formatCurrency(resumen.total_anulado)}</p>
		</Card>
	</div>

	{#if loading}
		<TableSkeleton columns={7} rows={10} />
	{:else if payments.length === 0}
		<div class="text-center py-12 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl">
			<p class="text-gray-500 dark:text-gray-400">No hay pagos en el rango y filtros seleccionados.</p>
		</div>
	{:else}
		<!-- Tabla desktop -->
		<div class="hidden md:block bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
				<thead class="bg-gray-50 dark:bg-dark-background">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha Comprobante</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Curso</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concepto</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
						<th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
					{#each payments as payment (payment._id)}
						<tr>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
								{payment.fecha_comprobante ? formatDate(payment.fecha_comprobante) : 'Sin registrar'}
							</td>
							<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{(payment as any).nombre_estudiante || '—'}</td>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-1" title={getCursoNombre(payment.curso_id)}>{getCursoNombre(payment.curso_id)}</td>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{payment.concepto}</td>
							<td class="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(payment.cantidad_pago)}</td>
							<td class="px-4 py-3 text-center">
								<span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${getStatusColor(payment.estado_pago)}`}>
									{payment.estado_pago}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Tarjetas móviles -->
		<div class="md:hidden space-y-3">
			{#each payments as payment (payment._id)}
				<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-bold text-gray-900 dark:text-white">{(payment as any).nombre_estudiante || '—'}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">{getCursoNombre(payment.curso_id)}</p>
						</div>
						<span class="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(payment.cantidad_pago)}</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{payment.fecha_comprobante ? formatDate(payment.fecha_comprobante) : 'Sin registrar'} · {payment.concepto}
						</p>
						<span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${getStatusColor(payment.estado_pago)}`}>
							{payment.estado_pago}
						</span>
					</div>
				</div>
			{/each}
		</div>

		<Pagination currentPage={page} {totalPages} {totalItems} {limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
	{/if}
</div>
