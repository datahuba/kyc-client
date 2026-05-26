<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService, enrollmentService, studentService } from '$lib/services';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { alert } from '$lib/utils';
	import type { Course, Enrollment, Student } from '$lib/interfaces';

	let courses: Course[] = $state([]);
	let enrollments: Enrollment[] = $state([]);
	let studentsMap: Record<string, Student> = $state({});
	
	let selectedCourseId = $state('');
	let selectedModuleIndex = $state('-1'); 
	
	let loadingData = $state(false);
	let savingIds = $state<Set<string>>(new Set()); 
	
	let notasInput: Record<string, string | number> = $state({});

	let selectedCourse = $derived(courses.find(c => c._id === selectedCourseId));

	onMount(async () => {
		try {
			const res = await courseService.getAll(1, 100);
			courses = res.data || [];
		} catch (e) {
			console.error("Error al cargar programas", e);
		}
	});

	async function loadEnrollments() {
		if (!selectedCourseId) {
			enrollments = [];
			selectedModuleIndex = '-1';
			return;
		}
		
		loadingData = true;
		try {
			// 1. Cargar las inscripciones del curso
			const resEnr = await enrollmentService.getAll(1, 500, { curso_id: selectedCourseId });
			enrollments = resEnr.data || (Array.isArray(resEnr) ? resEnr : []);

			// 2. Extraer IDs únicos y buscar a los estudiantes uno por uno (Evita el límite de 100 del backend)
			const studentIds = [...new Set(enrollments.map(e => e.estudiante_id))];
			
			const studentPromises = studentIds.map(id => studentService.getById(id).catch(() => null));
			const studentsList = await Promise.all(studentPromises);
			
			let mapTemp: Record<string, Student> = {};
			studentsList.forEach(s => {
				if (s && s._id) {
					mapTemp[s._id] = s;
				}
			});
			studentsMap = mapTemp; 

			resetNotasInput();
		} catch (e: any) {
			alert('error', 'Error al cargar la lista de estudiantes.');
			console.error(e);
		} finally {
			loadingData = false;
		}
	}

	function resetNotasInput() {
		const newNotas: Record<string, string | number> = {};
		const modIndex = parseInt(selectedModuleIndex);
		
		if (modIndex >= 0) {
			enrollments.forEach(enr => {
				const mod = enr.modulos[modIndex];
				newNotas[enr._id] = mod?.nota !== null && mod?.nota !== undefined ? mod.nota : '';
			});
		}
		notasInput = newNotas;
	}

	function onCourseChange() {
		selectedModuleIndex = '-1';
		enrollments = [];
		loadEnrollments();
	}

	function onModuleChange() {
		resetNotasInput();
	}

	async function saveNota(enrollmentId: string) {
		const modIndex = parseInt(selectedModuleIndex);
		const notaString = notasInput[enrollmentId];
		
		if (notaString === '' || notaString === null || notaString === undefined) {
			alert('error', 'El campo de nota no puede estar vacío');
			return;
		}

		const notaValue = parseFloat(notaString.toString());
		if (isNaN(notaValue) || notaValue < 0 || notaValue > 100) {
			alert('error', 'Por favor ingresa una nota válida entre 0 y 100');
			return;
		}

		savingIds.add(enrollmentId);
		savingIds = new Set(savingIds); 

		try {
			const response = await apiKyC.patch<Enrollment>(
				`/enrollments/${enrollmentId}/modulos/${modIndex}/nota`, 
				{ nota: notaValue }
			);
			
			const index = enrollments.findIndex(e => e._id === enrollmentId);
			if (index !== -1) {
				enrollments[index] = response;
			}
			alert('success', 'Calificación guardada correctamente');
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar la calificación');
		} finally {
			savingIds.delete(enrollmentId);
			savingIds = new Set(savingIds);
		}
	}
</script>

<div class="space-y-6">
	<Heading level="h1">Registro de Calificaciones</Heading>

	<!-- Selector de Programa y Módulo -->
	<Card class="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			
			<div class="flex flex-col gap-2">
				<label for="curso" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Programa Académico Asignado</label>
				<select 
					id="curso"
					bind:value={selectedCourseId} 
					onchange={onCourseChange}
					class="block w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm py-2.5"
				>
					<option value="">-- Seleccione un Programa --</option>
					{#each courses as course}
						<option value={course._id}>{course.nombre_programa} ({course.codigo})</option>
					{/each}
				</select>
			</div>

			<div class="flex flex-col gap-2">
				<label for="modulo" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Módulo a Calificar</label>
				<select 
					id="modulo"
					bind:value={selectedModuleIndex} 
					onchange={onModuleChange}
					disabled={!selectedCourse}
					class="block w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm py-2.5 disabled:opacity-50"
				>
					<option value="-1">-- Seleccione el Módulo --</option>
					{#if selectedCourse?.modulos}
						{#each selectedCourse.modulos as mod, i}
							<option value={i.toString()}>{mod.nombre}</option>
						{/each}
					{/if}
				</select>
			</div>
		</div>
	</Card>

	<!-- Planilla de Estudiantes -->
	{#if loadingData}
		<TableSkeleton columns={5} rows={5} />
	{:else if selectedCourseId && selectedModuleIndex !== '-1'}
		
		<div class="flex items-center justify-between mt-8 mb-4">
			<h2 class="text-lg font-bold text-slate-800 dark:text-white">Planilla de Estudiantes</h2>
			<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
				{enrollments.length} Inscritos
			</span>
		</div>

		<div class="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
			<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
				<thead class="bg-slate-100 dark:bg-slate-800">
					<tr>
						<th class="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estudiante</th>
						<th class="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Registro / CI</th>
						<th class="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Actual</th>
						<th class="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Calificación (0-100)</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
					{#each enrollments as enr (enr._id)}
						{@const student = studentsMap[enr.estudiante_id]}
						{@const modIndex = parseInt(selectedModuleIndex)}
						{@const modulo = enr.modulos[modIndex]}
						
						<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="font-medium text-slate-900 dark:text-white">{student?.nombre || 'Desconocido'}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-slate-500">{student?.registro || '-'} / {student?.carnet || '-'}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if modulo?.nota !== null && modulo?.nota !== undefined}
									{#if modulo.nota >= 64}
										<span class="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 rounded-full text-xs font-bold">Aprobado</span>
									{:else}
										<span class="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 rounded-full text-xs font-bold">Reprobado</span>
									{/if}
								{:else}
									<span class="px-2.5 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full text-xs font-bold">Cursando</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center gap-2">
									<input 
										type="number" 
										min="0" 
										max="100" 
										step="0.1"
										bind:value={notasInput[enr._id]}
										class="w-20 px-2 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-white text-center font-semibold"
										placeholder="--"
									/>
									<Button 
										onclick={() => saveNota(enr._id)} 
										loading={savingIds.has(enr._id)}
										variant="primary"
										class="px-3 py-1.5 text-xs shadow-sm"
									>
										Guardar
									</Button>
								</div>
							</td>
						</tr>
					{/each}
					{#if enrollments.length === 0}
						<tr>
							<td colspan="4" class="px-6 py-12 text-center text-slate-500">
								No se encontraron estudiantes inscritos en este programa.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>
