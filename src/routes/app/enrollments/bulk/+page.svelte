<script lang="ts">
	import { onMount } from 'svelte';
	import { enrollmentService, studentService, courseService, discountService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import type { Student, Course, Discount, BulkEnrollmentResponse } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import SearchInput from '$lib/components/ui/searchInput.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import { Pagination } from '$lib/components/ui';
	import { alert, formatCurrency } from '$lib/utils';
	import { PlusIcon, UsersIcon, CheckIcon, XIcon, ExclamationIcon } from '$lib/icons/outline';
	import { goto } from '$app/navigation';

	let students: Student[] = $state([]);
	let coursesList: Course[] = $state([]);
	let discountsList: Discount[] = $state([]);
	let selectedStudents: Set<string> = $state(new Set());
	let loading = $state(false);
	let submitting = $state(false);
	let result: BulkEnrollmentResponse | null = $state(null);

	// Form state
	let selectedCursoId: string = $state('');
	let selectedDescuentoId: string = $state('');
	let descuentoPersonalizado: number = $state(0);

	// Paginación / búsqueda
	let page: number = $state(1);
	let limit: number = $state(10);
	let totalItems: number = $state(0);
	let totalPages: number = $state(1);
	let searchQuery: string = $state('');
	let debounceTimer: any;

	let currentRole = $derived($userStore.role || '');
	let canBulkEnroll = $derived(
		['superadmin', 'admin', 'cpd', 'coordinador', 'encargado_curso'].includes(currentRole)
	);

	// ISSUE-R-ROLES (2026-07-10): encargado_curso solo ve sus cursos asignados
	let coursesListFiltrada: Course[] = $derived(
		currentRole === 'encargado_curso' && $userStore.user?.cursos_asignados
			? coursesList.filter((c) => $userStore.user!.cursos_asignados!.includes(c._id))
			: coursesList
	);

	let selectedCurso: Course | null = $derived(
		coursesListFiltrada.find((c) => c._id === selectedCursoId) || null
	);

	// F-IMPORT-EXCEL-BULK (2026-07-31): estado para importar Excel.
	let excelUploading = $state(false);
	let excelInputEl: HTMLInputElement | null = $state(null);
	let excelResult: {
		success: number;
		enrolled: number;
		errors: string[];
	} | null = $state(null);

	onMount(() => {
		if (!$userStore.isAuthenticated) {
			userStore.init();
		}
		loadAll();
	});

	async function loadAll() {
		loading = true;
		try {
			const [sRes, cRes, dRes] = await Promise.all([
				studentService.getAll(page, limit, searchQuery ? { q: searchQuery } : undefined),
				courseService.getAll(1, 100),
				discountService.getAll(1, 100).catch(() => ({ data: [] }))
			]);
			students = sRes.data;
			totalItems = sRes.meta?.totalItems ?? sRes.data.length;
			totalPages = sRes.meta?.totalPages ?? 1;
			coursesList = cRes.data;
			discountsList = dRes.data;
		} catch (e: any) {
			alert('error', e.message || 'Error al cargar datos');
		} finally {
			loading = false;
		}
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadAll();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadAll();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadAll();
	}

	function toggleStudent(id: string) {
		const next = new Set(selectedStudents);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedStudents = next;
	}

	function toggleAllOnPage() {
		const next = new Set(selectedStudents);
		const allSelected = students.every((s) => next.has(s._id));
		if (allSelected) {
			for (const s of students) next.delete(s._id);
		} else {
			for (const s of students) next.add(s._id);
		}
		selectedStudents = next;
	}

	function clearSelection() {
		selectedStudents = new Set();
	}

	// F-IMPORT-EXCEL-BULK (2026-07-31): subir un Excel con datos de
	// estudiantes. El backend crea los estudiantes nuevos y los inscribe
	// automáticamente al curso seleccionado (si se pasa curso_id).
	// Luego, en el frontend, los estudiantes que se crearon/inscribieron
	// quedan seleccionados para que el usuario vea qué se procesó.
	async function handleExcelFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!selectedCursoId) {
			alert('error', 'Selecciona primero un programa (paso 1) antes de importar el Excel.');
			input.value = '';
			return;
		}

		excelUploading = true;
		excelResult = null;
		try {
			// Reusar el endpoint existente POST /students/import/excel con
			// curso_id. El backend crea los estudiantes nuevos y los
			// inscribe automáticamente al programa seleccionado.
			// F-EXCEL-IMPORT-MIXED (2026-08-03, Kevin): si hay emails mal,
			// se reportan en errors[] PERO se importan los válidos.
			const res = await studentService.importFromExcel(file, selectedCursoId);
			excelResult = {
				success: res.success_count,
				enrolled: res.enrolled_count,
				errors: res.errors || []
			};

			const errCount = (res.errors || []).length;
			if (res.enrolled_count > 0 && errCount > 0) {
				alert('warning',
					`Se importaron ${res.enrolled_count} estudiante(s) y se inscribieron al curso. ` +
					`${errCount} fila(s) con errores (ver abajo).`
				);
			} else if (res.enrolled_count > 0) {
				alert('success',
					`${res.enrolled_count} estudiante(s) inscrito(s) automáticamente al curso.`
				);
			} else if (res.success_count > 0) {
				alert('warning',
					`Se procesaron ${res.success_count} estudiantes pero ninguno fue inscrito. Revisa los errores.`
				);
			} else if (errCount > 0) {
				alert('error',
					`No se pudo importar ningún estudiante. ${errCount} error(es) detectado(s). Ver abajo.`
				);
			} else {
				alert('error', 'No se pudo procesar el Excel. Revisa el formato.');
			}

			// Recargar la lista de estudiantes para que aparezcan los nuevos
			await loadAll();
		} catch (e: any) {
			const detail = e?.response?.data?.detail || e?.message || 'No se pudo importar el Excel';
			alert('error', detail);
		} finally {
			excelUploading = false;
			input.value = '';
		}
	}

	function triggerExcelUpload() {
		excelInputEl?.click();
	}

	async function handleSubmit() {
		if (!selectedCursoId) {
			alert('error', 'Selecciona un programa');
			return;
		}
		if (selectedStudents.size === 0) {
			alert('error', 'Selecciona al menos un estudiante');
			return;
		}
		if (selectedStudents.size > 200) {
			alert('error', 'Máximo 200 estudiantes por lote');
			return;
		}

		submitting = true;
		try {
			const body: any = {
				curso_id: selectedCursoId,
				estudiantes_ids: Array.from(selectedStudents)
			};
			if (selectedDescuentoId) body.descuento_id = selectedDescuentoId;
			else if (descuentoPersonalizado > 0) body.descuento_personalizado = descuentoPersonalizado;

			const r = await enrollmentService.createBulk(body);
			result = r;
			if (r.exitosos > 0) {
				alert('success', `${r.exitosos} inscrito(s) correctamente`);
			}
			if (r.ya_inscritos > 0) {
				alert('warning', `${r.ya_inscritos} ya estaba(n) inscrito(s) en este programa`);
			}
			if (r.fallidos > 0) {
				alert('error', `${r.fallidos} fallaron. Ver detalle abajo.`);
			}
		} catch (e: any) {
			const detail = e?.response?.data?.detail || e?.message || 'Error al inscribir en lote';
			alert('error', detail);
		} finally {
			submitting = false;
		}
	}

	function closeResult() {
		result = null;
		clearSelection();
	}
</script>


<svelte:head>
	<title>Inscripción Masiva · KYC DataHub</title>
</svelte:head>
<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Inscripción en Lote</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Inscribe hasta 200 estudiantes a un mismo programa en una sola operación.
			</p>
		</div>
		<Button variant="secondary" onclick={() => goto('/app/enrollments')}>
			Volver a Inscripciones
		</Button>
	</div>

	{#if !canBulkEnroll}
		<Card>
			<div class="p-6 text-center text-gray-500">
				No tienes permisos para inscripción en lote.
			</div>
		</Card>
	{:else}
		<!-- Paso 1: Seleccionar programa y descuento -->
		<Card>
			<div class="p-6 space-y-4">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
					<span class="bg-primary-600 text-white rounded-full size-7 flex items-center justify-center text-sm font-black">1</span>
					Selecciona el programa
				</h2>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="curso" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Programa <span class="text-red-500">*</span>
						</label>
						<select
							id="curso"
							bind:value={selectedCursoId}
							class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						>
							<option value="">-- Seleccionar programa --</option>
							{#each coursesListFiltrada as c (c._id)}
								<option value={c._id}>
									{c.codigo ? c.codigo + ' · ' : ''}{c.nombre_programa}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="descuento" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Descuento / Beca grupal (opcional)
						</label>
						<select
							id="descuento"
							bind:value={selectedDescuentoId}
							class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						>
							<option value="">-- Sin descuento --</option>
							{#each discountsList.filter((d) => d.activo) as d (d._id)}
								<option value={d._id}>
									{d.nombre} ({d.porcentaje}%)
								</option>
							{/each}
						</select>
					</div>
				</div>

				{#if !selectedDescuentoId}
					<div>
						<label for="desc-pers" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							O descuento personalizado (%)
						</label>
						<input
							id="desc-pers"
							type="number"
							min="0"
							max="100"
							step="1"
							bind:value={descuentoPersonalizado}
							class="block w-full max-w-xs rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
							placeholder="0"
						/>
					</div>
				{/if}

				{#if selectedCurso}
					<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
						<p class="font-bold text-blue-900 dark:text-blue-200">
							{selectedCurso.nombre_programa}
						</p>
						<p class="text-blue-700 dark:text-blue-300 text-xs mt-1">
							Total: {formatCurrency(selectedCurso.costo_total_interno || 0)} ·
							Módulos: {selectedCurso.modulos?.length || 0} ·
							Cuotas: {selectedCurso.cantidad_cuotas || 0}
						</p>
					</div>
				{/if}
			</div>
		</Card>

		<!-- Paso 2: Seleccionar estudiantes -->
		<Card>
			<div class="p-6 space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
						<span class="bg-primary-600 text-white rounded-full size-7 flex items-center justify-center text-sm font-black">2</span>
						Selecciona los estudiantes
					</h2>
					<div class="flex items-center gap-2">
						<span class="text-sm font-bold text-primary-700 dark:text-primary-300">
							{selectedStudents.size} seleccionado{selectedStudents.size === 1 ? '' : 's'}
						</span>
						{#if selectedStudents.size > 0}
							<Button size="sm" variant="secondary" onclick={clearSelection}>
								Limpiar
							</Button>
						{/if}
					</div>
				</div>

				<div class="flex flex-col sm:flex-row gap-3">
					<div class="flex-1">
						<SearchInput
							bind:value={searchQuery}
							placeholder="Buscar estudiante por nombre, CI o registro..."
							onInput={() => handleSearchInput()}
						/>
					</div>
				</div>

				<!-- F-IMPORT-EXCEL-BULK (2026-07-31, fix 2026-07-31):
				     opcion para subir un Excel con datos de estudiantes.
				     El backend crea los nuevos y los inscribe directamente
				     al programa seleccionado (paso 1).
				     FIX: antes estaba disabled si no habia programa. Ahora
				     el boton siempre esta disponible -- si no hay programa
				     seleccionado, la funcion handleExcelFileChange avisa al
				     usuario. Asi Kevin puede subir el Excel desde esta
				     pantalla sin tener que ir y volver entre el paso 1. -->
				<div class="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<svg class="size-5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<p class="text-sm font-bold text-blue-900 dark:text-blue-200">
									Importar estudiantes desde Excel
								</p>
							</div>
							<p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
								{#if selectedCursoId}
									Sube el archivo (.xlsx, .xls, .csv) y se crearán los estudiantes nuevos
									y se inscribirán automáticamente al programa seleccionado.
								{:else}
									<span class="font-semibold">⚠ Selecciona primero un programa en el paso 1</span>
									para que los estudiantes importados se inscriban automáticamente.
								{/if}
							</p>
						</div>
						<div class="shrink-0">
							<input
								bind:this={excelInputEl}
								type="file"
								accept=".xlsx,.xls,.csv"
								class="hidden"
								onchange={handleExcelFileChange}
							/>
							<Button
								size="sm"
								variant="secondary"
								onclick={triggerExcelUpload}
								loading={excelUploading}
							>
								Subir Excel
							</Button>
						</div>
					</div>
					{#if excelResult}
						<div class="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
							<p>
								<strong>Procesados:</strong> {excelResult.success} ·
								<strong>Inscritos:</strong> {excelResult.enrolled}
							</p>
							{#if excelResult.errors.length > 0}
								<details class="text-red-700 dark:text-red-300">
									<summary class="cursor-pointer font-semibold">
										{excelResult.errors.length} error(es) - click para ver
									</summary>
									<ul class="mt-1 pl-4 list-disc space-y-0.5">
										{#each excelResult.errors.slice(0, 10) as err}
											<li>{err}</li>
										{/each}
										{#if excelResult.errors.length > 10}
											<li>... y {excelResult.errors.length - 10} más</li>
										{/if}
									</ul>
								</details>
							{/if}
						</div>
					{/if}
				</div>

				{#if loading}
					<Skeleton variant="table" columns={4} rows={8} />
				{:else if students.length === 0}
					<EmptyState
						icon="student"
						title="Sin estudiantes"
						description="No hay estudiantes que coincidan con tu búsqueda."
					/>
				{:else}
					<div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead class="bg-gray-50 dark:bg-gray-800">
								<tr>
									<th class="w-12 px-3 py-3">
										<Checkbox
											checked={students.length > 0 && students.every((s) => selectedStudents.has(s._id))}
											onchange={toggleAllOnPage}
										/>
									</th>
									<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
									<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CI</th>
									<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Registro</th>
								</tr>
							</thead>
							<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-gray-700">
								{#each students as student (student._id)}
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
										<td class="px-3 py-3">
											<Checkbox
												checked={selectedStudents.has(student._id)}
												onchange={() => toggleStudent(student._id)}
											/>
										</td>
										<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
											{student.nombre}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
											{student.carnet || '—'}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
											{student.registro || '—'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<Pagination
						currentPage={page}
						{totalPages}
						{totalItems}
						{limit}
						onPageChange={handlePageChange}
						onLimitChange={handleLimitChange}
					/>
				{/if}
			</div>
		</Card>

		<!-- Paso 3: Confirmar y enviar -->
		<Card>
			<div class="p-6 space-y-4">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
					<span class="bg-primary-600 text-white rounded-full size-7 flex items-center justify-center text-sm font-black">3</span>
					Confirmar
				</h2>

				<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
					<ExclamationIcon class="size-5 shrink-0 mt-0.5" />
					<p>
						Se crearán <strong>{selectedStudents.size}</strong> inscripción{selectedStudents.size === 1 ? '' : 'es'} nuevas.
						Los estudiantes que ya estén inscritos en este programa se reportarán como "ya inscritos" sin afectar la operación.
					</p>
				</div>

				<div class="flex items-center gap-3">
					<Button
						onclick={handleSubmit}
						disabled={!selectedCursoId || selectedStudents.size === 0 || submitting}
						loading={submitting}
					>
						{#snippet leftIcon()}
							<UsersIcon class="size-5" />
						{/snippet}
						Inscribir {selectedStudents.size} estudiante{selectedStudents.size === 1 ? '' : 's'}
					</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<!-- Modal de resultado -->
<Modal
	isOpen={result !== null}
	title="Resultado de Inscripción en Lote"
	onClose={closeResult}
	maxWidth="sm:max-w-2xl"
>
	{#if result}
		<div class="p-6 space-y-4">
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
					<p class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Total</p>
					<p class="text-2xl font-black text-blue-900 dark:text-blue-100">{result.total_solicitados}</p>
				</div>
				<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
					<p class="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Exitosos</p>
					<p class="text-2xl font-black text-green-900 dark:text-green-100 flex items-center justify-center gap-1">
						<CheckIcon class="size-5" />{result.exitosos}
					</p>
				</div>
				<div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
					<p class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Ya inscritos</p>
					<p class="text-2xl font-black text-amber-900 dark:text-amber-100">{result.ya_inscritos}</p>
				</div>
				<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
					<p class="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Fallidos</p>
					<p class="text-2xl font-black text-red-900 dark:text-red-100 flex items-center justify-center gap-1">
						{#if result.fallidos > 0}<XIcon class="size-5" />{/if}{result.fallidos}
					</p>
				</div>
			</div>

			{#if result.errores.length > 0}
				<div>
					<h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Detalle de errores</h3>
					<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-h-60 overflow-y-auto space-y-1">
						{#each result.errores as err}
							<div class="text-xs font-mono text-red-900 dark:text-red-200 flex items-start gap-2">
								<XIcon class="size-3.5 shrink-0 mt-0.5" />
								<span><strong>{err.estudiante_id}</strong>: {err.error}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="secondary" onclick={closeResult}>
					Cerrar
				</Button>
				{#if result.exitosos > 0}
					<Button onclick={() => goto('/app/enrollments')}>
						Ver Inscripciones
						{#snippet rightIcon()}
							<UsersIcon class="size-4" />
						{/snippet}
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</Modal>
