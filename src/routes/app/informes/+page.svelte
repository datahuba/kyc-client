<script lang="ts">
	// F-075 (2026-07-23): Página "Informes" — Lista de Postgraduantes Habilitados
	// Informe para aprobación de acta de notas. Estilo papel Sandra.
	// Permite elegir curso + módulo y genera la lista con encabezado + filas.
	import { onMount } from 'svelte';
	import { paymentService, courseService } from '$lib/services';
	import type { Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import { alert, formatCurrency, formatDate } from '$lib/utils';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { SearchIcon, DownloadIcon, FileTextIcon } from '$lib/icons/outline';

	interface FilaHabilitado {
		estudiante_id: string;
		registro: string;
		nombre: string;
		ci: string;
		modulo_index: number;
		modulo_nombre: string;
		modulo_label: string;
		docente: string;
		fecha_pago: string | null;
		numero_boleta: string;
		importe: number;
		costo_original_modulo: number;
		beca: string | null;
		beca_porcentaje: number;
	}

	interface Encabezado {
		titulo: string;
		programa_tipo: string;
		programa_nombre: string;
		modulo: string;
		periodo: string;
		docente: string;
	}

	interface ListaHabilitadosResponse {
		curso: { id: string; codigo: string; nombre_programa: string; tipo_curso: string; tipo_label: string };
		encabezado: Encabezado;
		rows: FilaHabilitado[];
		total_importe: number;
		total_estudiantes: number;
	}

	let coursesList: Course[] = $state([]);
	let selectedCourseId = $state('');
	let selectedModulo: number | '' = $state(''); // '' = todos
	let loading = $state(false);
	let loadingCourses = $state(true);
	let data: ListaHabilitadosResponse | null = $state(null);

	// Lista de módulos del curso seleccionado (se llena al elegir curso)
	let modulosDelCurso = $state<Array<{ index: number; nombre: string }>>([]);

	onMount(async () => {
		try {
			const resp = await courseService.getAll(1, 100);
			coursesList = resp.data || [];
		} catch (e) {
			console.error('Error cargando cursos', e);
			alert('error', 'No se pudieron cargar los cursos.');
		} finally {
			loadingCourses = false;
		}
	});

	// Cuando cambia el curso, actualizar módulos
	$effect(() => {
		const c = coursesList.find((c) => c._id === selectedCourseId);
		if (c && Array.isArray((c as any).modulos)) {
			modulosDelCurso = (c as any).modulos.map((m: any, i: number) => ({
				index: i + 1,
				nombre: m.nombre || `Módulo ${i + 1}`,
			}));
		} else {
			modulosDelCurso = [];
		}
	});

	async function generarInforme() {
		if (!selectedCourseId) {
			alert('error', 'Selecciona un curso para generar el informe.');
			return;
		}
		loading = true;
		data = null;
		try {
			const modParam = selectedModulo === '' ? '' : `&modulo_index=${selectedModulo}`;
			const url = `/payments/reportes/lista-habilitados?curso_id=${selectedCourseId}${modParam}`;
			const resp = await paymentService.rawGet(url);
			data = resp as ListaHabilitadosResponse;
			if (data.rows.length === 0) {
				alert('warning', 'No hay estudiantes con pagos para el módulo seleccionado.');
			}
		} catch (e: any) {
			console.error(e);
			alert('error', e?.message || 'Error al generar el informe.');
		} finally {
			loading = false;
		}
	}

	// Descargar como XLSX (CSV simple por ahora, fácil de abrir en Excel)
	function descargarCSV() {
		if (!data || data.rows.length === 0) return;
		const lines: string[] = [];
		// Encabezado
		lines.push(`"${data.encabezado.titulo}"`);
		lines.push(`"${data.encabezado.programa_tipo}: ${data.encabezado.programa_nombre}"`);
		lines.push(`"MÓDULO: ${data.encabezado.modulo}"`);
		lines.push(`"PERÍODO: ${data.encabezado.periodo || 'N/A'}"`);
		lines.push(`"DOCENTE: ${data.encabezado.docente || 'N/A'}"`);
		lines.push('');
		// Columnas (estilo papel Sandra) - F-075-FIX-8 incluye Estado y Pendiente
		lines.push(['N°', 'Apellido y Nombre', 'C.I.', 'Estado', 'Fecha', 'N° Boleta', 'Importe Bs.', 'Pendiente', 'Beca'].join(','));
		data.rows.forEach((r, i) => {
			const cols = [
				String(i + 1),
				`"${r.nombre}"`,
				`"${r.ci}"`,
				r.estado_pago || 'PENDIENTE',
				r.fecha_pago ? formatDate(r.fecha_pago) : '',
				`"${r.numero_boleta || ''}"`,
				(r.importe || 0).toFixed(2),
				(r.monto_pendiente || 0).toFixed(2),
				r.beca ? `${r.beca} (${r.beca_porcentaje}%)` : 'Sin beca',
			];
			lines.push(cols.join(','));
		});
		lines.push('');
		lines.push(`"TOTAL ESTUDIANTES: ${data.total_estudiantes}"`);
		lines.push(`"TOTAL IMPORTE PAGADO: Bs. ${data.total_importe.toFixed(2)}"`);
		lines.push(`"TOTAL PENDIENTE: Bs. ${(data.total_pendiente || 0).toFixed(2)}"`);

		const csv = '\uFEFF' + lines.join('\n'); // BOM para que Excel respete acentos
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const fname = data.encabezado.modulo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
		a.download = `lista_habilitados_${fname}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function formatFechaPago(fecha: string | null): string {
		if (!fecha) return 'S/F';
		try {
			const d = new Date(fecha);
			if (isNaN(d.getTime())) return fecha;
			return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
		} catch {
			return fecha;
		}
	}
</script>

<div class="space-y-6 pb-8">
	<div class="flex items-center justify-between">
		<Heading level="h1">Informes</Heading>
	</div>

	<!-- Filtros -->
	<Card>
		{#snippet header()}
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-light-secondary/10 dark:bg-dark-secondary/10">
					<FileTextIcon class="h-5 w-5 text-light-secondary dark:text-dark-secondary" />
				</div>
				<div>
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">Lista de Postgraduantes Habilitados</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">Informe económico para aprobación de acta de notas</p>
				</div>
			</div>
		{/snippet}

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div>
				<Select label="Programa" id="curso" bind:value={selectedCourseId} required>
					<option value="">Seleccione un programa</option>
					{#each coursesList as c}
						<option value={c._id}>{c.codigo} — {c.nombre_programa}</option>
					{/each}
				</Select>
			</div>
			<div>
				<Select label="Módulo" id="modulo" bind:value={selectedModulo}>
					<option value="">Todos los módulos</option>
					<option value={0}>Matrícula</option>
					{#each modulosDelCurso as m}
						<option value={m.index}>Módulo {m.index} — {m.nombre}</option>
					{/each}
				</Select>
			</div>
			<div class="flex items-end">
				<Button onclick={generarInforme} loading={loading} disabled={!selectedCourseId || loadingCourses} class="w-full">
					{#snippet leftIcon()}<SearchIcon class="size-4" />{/snippet}
					Generar Informe
				</Button>
			</div>
		</div>
	</Card>

	<!-- Resultado -->
	{#if data}
		<Card>
			{#snippet header()}
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 class="text-center text-xl font-bold uppercase tracking-wider text-gray-900 dark:text-white">
							{data.encabezado.titulo}
						</h2>
					</div>
					<Button variant="secondary" onclick={descargarCSV} disabled={data.rows.length === 0}>
						{#snippet leftIcon()}<DownloadIcon class="size-4" />{/snippet}
						Descargar CSV
					</Button>
				</div>
			{/snippet}

			<!-- Encabezado del informe (estilo papel) -->
			<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-dark-border dark:bg-dark-surface/50">
				<p class="mb-1"><span class="font-semibold">{data.encabezado.programa_tipo}:</span> {data.encabezado.programa_nombre}</p>
				<p class="mb-1"><span class="font-semibold">MÓDULO:</span> {data.encabezado.modulo}</p>
				<p class="mb-1"><span class="font-semibold">PERÍODO:</span> {data.encabezado.periodo || 'N/A'}</p>
				<p><span class="font-semibold">DOCENTE:</span> {data.encabezado.docente || 'N/A'}</p>
			</div>

			{#if data.rows.length === 0}
				<p class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
					No hay estudiantes inscritos en este módulo.
				</p>
			{:else}
				<!-- Resumen rapido (F-075-FIX-8): muestra cuantos pagaron y cuantos deben -->
				{@const pagados = data.rows.filter((r) => r.estado_pago === 'PAGADO').length}
				{@const parciales = data.rows.filter((r) => r.estado_pago === 'PARCIAL').length}
				{@const pendientes = data.rows.filter((r) => r.estado_pago === 'PENDIENTE').length}
				<div class="mb-3 flex flex-wrap gap-3 text-sm">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-light-success/15 px-3 py-1 font-semibold text-light-success dark:bg-dark-success/20 dark:text-dark-success">
						<span class="size-2 rounded-full bg-light-success"></span>
						{pagados} Pagados
					</span>
					{#if parciales > 0}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-light-warning/15 px-3 py-1 font-semibold text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning">
							<span class="size-2 rounded-full bg-light-warning"></span>
							{parciales} Parciales
						</span>
					{/if}
					{#if pendientes > 0}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-light-error/15 px-3 py-1 font-semibold text-light-error dark:bg-dark-error/20 dark:text-dark-error">
							<span class="size-2 rounded-full bg-light-error"></span>
							{pendientes} Pendientes
						</span>
					{/if}
				</div>

				<!-- Tabla estilo papel (F-075-FIX-8: incluye estado + pendiente) -->
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr class="border-b-2 border-gray-300 bg-gray-100 text-xs uppercase dark:border-dark-border dark:bg-dark-surface">
								<th class="px-2 py-2 text-center font-bold">N°</th>
								<th class="px-2 py-2 text-left font-bold">Apellido y Nombre</th>
								<th class="px-2 py-2 text-center font-bold">C.I.</th>
								<th class="px-2 py-2 text-center font-bold">Estado</th>
								<th class="px-2 py-2 text-center font-bold">Fecha</th>
								<th class="px-2 py-2 text-center font-bold">N° Boleta</th>
								<th class="px-2 py-2 text-right font-bold">Importe Bs.</th>
								<th class="px-2 py-2 text-right font-bold">Pendiente</th>
								<th class="px-2 py-2 text-center font-bold">Beca</th>
							</tr>
						</thead>
						<tbody>
							{#each data.rows as r, i (r.estudiante_id + '-' + r.modulo_index)}
								<tr
									class="border-b border-gray-200 hover:bg-gray-50 dark:border-dark-border dark:hover:bg-dark-surface/30 {r.estado_pago === 'PENDIENTE' ? 'bg-red-50/30 dark:bg-red-900/10' : r.estado_pago === 'PARCIAL' ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}"
								>
									<td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{i + 1}</td>
									<td class="px-2 py-2 font-medium text-gray-900 dark:text-white">{r.nombre}</td>
									<td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{r.ci}</td>
									<td class="px-2 py-2 text-center">
										{#if r.estado_pago === 'PAGADO'}
											<span class="inline-block rounded-full bg-light-success/20 px-2 py-0.5 text-[10px] font-bold uppercase text-light-success dark:bg-dark-success/30 dark:text-dark-success">
												✓ Pagado
											</span>
										{:else if r.estado_pago === 'PARCIAL'}
											<span class="inline-block rounded-full bg-light-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase text-light-warning dark:bg-dark-warning/30 dark:text-dark-warning">
												⏳ Parcial
											</span>
										{:else}
											<span class="inline-block rounded-full bg-light-error/20 px-2 py-0.5 text-[10px] font-bold uppercase text-light-error dark:bg-dark-error/30 dark:text-dark-error">
												✗ Pendiente
											</span>
										{/if}
									</td>
									<td class="px-2 py-2 text-center text-gray-700 dark:text-gray-300">
										{r.fecha_pago ? formatFechaPago(r.fecha_pago) : '—'}
									</td>
									<td class="px-2 py-2 text-center font-mono text-xs text-gray-700 dark:text-gray-300">
										{r.numero_boleta || '—'}
									</td>
									<td class="px-2 py-2 text-right font-semibold text-gray-900 dark:text-white">
										{r.importe.toFixed(2)}
										{#if r.beca && r.beca_porcentaje > 0 && r.importe > 0}
											<span
												class="ml-1 inline-block cursor-help text-xs text-light-secondary dark:text-dark-secondary"
												title={`Beca ${r.beca} (${r.beca_porcentaje}%). Costo original del módulo: Bs ${(r.costo_sin_descuento ?? r.costo_total).toFixed(2)}. Costo con descuento (lo que el estudiante debe pagar): Bs ${r.costo_total.toFixed(2)}. Pagó: Bs ${r.importe.toFixed(2)}.`}
											>
												ℹ️
											</span>
										{/if}
									</td>
									<td class="px-2 py-2 text-center text-xs">
										{#if r.beca}
											<span
												class="inline-block cursor-help rounded-full bg-light-warning/15 px-2 py-0.5 font-semibold text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning"
												title={`Beca: ${r.beca} — ${r.beca_porcentaje}% de descuento aplicado a módulos (no aplica a matrícula).`}
											>
												{r.beca_porcentaje}%
											</span>
										{:else}
											<span class="text-gray-400">-</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-dark-border dark:bg-dark-surface/50">
								<td colspan="6" class="px-2 py-2 text-right uppercase">Totales</td>
								<td class="px-2 py-2 text-right text-base text-light-secondary dark:text-dark-secondary">
									Bs. {data.total_importe.toFixed(2)}
								</td>
								<td class="px-2 py-2 text-right text-base text-light-error dark:text-dark-error">
									Bs. {(data.total_pendiente || 0).toFixed(2)}
								</td>
								<td class="text-center text-xs text-gray-600 dark:text-gray-400">
									{data.total_estudiantes} est.
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</Card>
	{/if}
</div>
