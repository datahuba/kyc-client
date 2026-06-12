<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService, enrollmentService, studentService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';
	import type { Course, Enrollment, Student } from '$lib/interfaces';

	let loading = $state(true);
    let myModules: any[] = $state([]); 
	let enrollments: Enrollment[] = $state([]);
	let students: Record<string, Student> = $state({});

    let activeModule: any | null = $state(null);
    let moduleEnrollments: Enrollment[] = $state([]);
	
	let calificacionInputs: Record<string, number | ''> = $state({});
	let savingCalificacion: Record<string, boolean> = $state({});
	let savingAll = $state(false);

	onMount(async () => {
		try {
            const userId = $userStore.user?._id;
            if (!userId) return;

            myModules = await courseService.getModulesByTeacher(userId);
		} catch (error: any) {
			alert('error', error.message || 'Error al cargar información del docente');
		} finally {
			loading = false;
		}
	});

    async function loadStudentsForModule(module: any) {
        activeModule = module;
        loading = true;
        try {
            const courseEnrollments = await enrollmentService.getByCourseId(module.curso_id);
            moduleEnrollments = courseEnrollments.filter(e => e.estado === 'activo');

            // Carga concurrente segura (Tolerante a fallos 404 por borrado físico)
            await Promise.all(
                moduleEnrollments.map(async (enrollment) => {
                    if (!students[enrollment.estudiante_id]) {
                        try {
                            const st = await studentService.getById(enrollment.estudiante_id);
                            if (st) students[enrollment.estudiante_id] = st;
                        } catch (studentError: any) {
                            // Bug 2 Fix: Si el alumno fue eliminado pero retiene deudas/notas,
                            // inyectamos un objeto mockeado para evitar colapso de la tabla.
                            students[enrollment.estudiante_id] = {
                                _id: enrollment.estudiante_id,
                                nombre: "Estudiante Eliminado",
                                registro: "N/A",
                                carnet: "N/A",
                                isDeleted: true // Bandera lógica para la UI
                            } as any;
                        }
                    }

                    const realIndex = module.modulo_index - 1;
                    if (enrollment.modulos && enrollment.modulos.length > realIndex) {
                        const notaGuardada = enrollment.modulos[realIndex].nota;
                        calificacionInputs[enrollment._id] = notaGuardada !== null && notaGuardada !== undefined ? notaGuardada : '';
                    } else {
                        calificacionInputs[enrollment._id] = '';
                    }
                })
            );
        } catch (error: any) {
            alert('error', 'Error al cargar inscripciones del módulo.');
        } finally {
            loading = false;
        }
    }

	async function saveCalificacion(enrollmentId: string, showSuccessAlert = true) {
        if (!activeModule) return;
        
		const nota = calificacionInputs[enrollmentId];
		if (nota === '' || nota === null) {
			if(showSuccessAlert) alert('error', 'Ingrese una nota válida');
			return false;
		}

		if (Number(nota) < 0 || Number(nota) > 100) {
			if(showSuccessAlert) alert('error', 'La nota debe estar entre 0 y 100');
			return false;
		}

		savingCalificacion[enrollmentId] = true;
		try {
            const moduleArrayIndex = activeModule.modulo_index - 1;
			const response = await enrollmentService.updateModuloNota(enrollmentId, moduleArrayIndex, Number(nota));
			
			const index = moduleEnrollments.findIndex(e => e._id === enrollmentId);
			if (index !== -1) {
				moduleEnrollments[index] = response;
			}
			
			if(showSuccessAlert) alert('success', 'Calificación guardada correctamente');
			return true;
		} catch (error: any) {
			if(showSuccessAlert) alert('error', error.message || 'Error al guardar la calificación');
			return false;
		} finally {
			savingCalificacion[enrollmentId] = false;
		}
	}

	async function saveAllCalificaciones() {
		savingAll = true;
		let successCount = 0;
		let failCount = 0;

		for (const enrollment of moduleEnrollments) {
			const nota = calificacionInputs[enrollment._id];
			if (nota !== '' && nota !== null && nota !== undefined) {
				const result = await saveCalificacion(enrollment._id, false);
				if (result) successCount++;
				else failCount++;
			}
		}

		savingAll = false;
		if (successCount > 0) alert('success', `Se guardaron ${successCount} calificaciones exitosamente.`);
		if (failCount > 0) alert('error', `Hubo problemas guardando ${failCount} calificaciones.`);
	}

	function exportCSV() {
		if (!activeModule || moduleEnrollments.length === 0) return;

		const headers = ['Estudiante', 'Registro', 'CI', 'Calificacion'];
		const rows = moduleEnrollments.map(e => {
			const student = students[e.estudiante_id];
			const realIndex = activeModule.modulo_index - 1;
			const notaActual = (e.modulos && e.modulos.length > realIndex) ? e.modulos[realIndex].nota : '';
			
			return [
				`"${student?.nombre || 'Desconocido'}"`,
				student?.registro || '',
				student?.carnet || '',
				notaActual !== null ? notaActual : ''
			];
		});

		const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
		const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `Planilla_${activeModule.curso_codigo}_Modulo${activeModule.modulo_index}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function importCSV(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			const rows = text.split(/\r?\n/).map(row => row.split(','));
			
			let importedCount = 0;
			for (let i = 1; i < rows.length; i++) {
				const row = rows[i];
				if (row.length >= 4) {
					const registroStr = row[1]?.replace(/"/g, '').trim();
					const ciStr = row[2]?.replace(/"/g, '').trim();
					const notaStr = row[3]?.replace(/"/g, '').trim();
					
					if (notaStr !== '') {
						const notaNum = Number(notaStr);
						if (!isNaN(notaNum) && notaNum >= 0 && notaNum <= 100) {
							const enrollmentMatch = moduleEnrollments.find(enr => {
								const st = students[enr.estudiante_id];
								return st?.registro === registroStr || st?.carnet === ciStr;
							});

							if (enrollmentMatch) {
								calificacionInputs[enrollmentMatch._id] = notaNum;
								importedCount++;
							}
						}
					}
				}
			}

			if (importedCount > 0) {
				alert('success', `Se cargaron ${importedCount} notas en pantalla. Por favor, revisa y haz clic en "Guardar Todo".`);
			} else {
				alert('warning', 'No se encontraron notas válidas que coincidan con los registros de los estudiantes.');
			}
			
			target.value = '';
		};
		reader.readAsText(file);
	}

	function getStudentStatus(enrollment: Enrollment, moduleIndexBase0: number) {
        if (!enrollment.modulos || enrollment.modulos.length <= moduleIndexBase0) return { label: 'Sin Datos', class: 'bg-gray-100 text-gray-800' };

        const modulo = enrollment.modulos[moduleIndexBase0];
        if (modulo.nota === null || modulo.nota === undefined) return { label: 'Cursando', class: 'bg-blue-100 text-blue-800' };
        if (modulo.nota >= 51) return { label: 'Aprobado', class: 'bg-green-100 text-green-800' };
        return { label: 'Reprobado', class: 'bg-red-100 text-red-800' };
	}
</script>

<div class="space-y-8 max-w-7xl mx-auto">
	<div>
		<Heading level="h1">Dashboard Docente</Heading>
		<p class="text-gray-500 dark:text-gray-400 mt-1">Selecciona un módulo para gestionar las calificaciones</p>
	</div>

	{#if loading && myModules.length === 0}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
		</div>
    {:else if myModules.length === 0}
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
			<svg class="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
			</svg>
            <p class="text-gray-500 dark:text-gray-400 font-medium">No tienes módulos asignados en este momento.</p>
            <p class="text-sm text-gray-400 mt-2">Comunícate con el área de Gestión Académica (CPD) si esto es un error.</p>
        </div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each myModules as module}
                <div 
                    onclick={() => loadStudentsForModule(module)}
                    class={`bg-white dark:bg-gray-800 rounded-xl border p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md
                        ${activeModule?.curso_id === module.curso_id && activeModule?.modulo_index === module.modulo_index 
                            ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10 dark:bg-indigo-900/10' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`
                    }
                >
                    <div class="flex justify-between items-start mb-4">
                        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 text-sm font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                            {module.modulo_index}
                        </span>
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                            {module.curso_codigo}
                        </span>
                    </div>
                    
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate" title={module.modulo_nombre}>
                        {module.modulo_nombre}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
                        {module.curso_nombre}
                    </p>

                    <div class="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <span class="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center gap-1 group-hover:underline">
                            Ver Planilla &rarr;
                        </span>
                    </div>
                </div>
            {/each}
		</div>

        {#if activeModule}
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in mt-8">
                
				<div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
							Planilla de Estudiantes
							<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
								<svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
								</svg> 
								{moduleEnrollments.length}
							</span>
						</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">{activeModule.modulo_nombre} • {activeModule.curso_codigo}</p>
                    </div>
                    
					<div class="flex flex-wrap items-center gap-2 w-full xl:w-auto">
						<Button variant="secondary" class="text-sm py-1.5" onclick={exportCSV}>
							{#snippet leftIcon()}
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
							{/snippet}
							Exportar Planilla
						</Button>
						
						<input type="file" id="csv-upload" accept=".csv" class="hidden" onchange={importCSV} />
						<Button variant="secondary" class="text-sm py-1.5" onclick={() => document.getElementById('csv-upload')?.click()}>
							{#snippet leftIcon()}
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
								</svg>
							{/snippet}
							Importar Notas
						</Button>

						<Button variant="primary" class="text-sm py-1.5 ml-auto" loading={savingAll} onclick={saveAllCalificaciones}>
							{#snippet leftIcon()}
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{/snippet}
							Guardar Todo
						</Button>
					</div>
                </div>

                {#if loading}
                    <div class="flex justify-center py-12">
                        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                    </div>
                {:else if moduleEnrollments.length === 0}
                    <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                        No hay estudiantes inscritos (activos) en este programa académico.
                    </div>
                {:else}
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estudiante</th>
                                    <th class="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registro / CI</th>
                                    <th class="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado Actual</th>
                                    <th class="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Calificación (0-100)</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                {#each moduleEnrollments as enrollment (enrollment._id)}
                                    {@const student = students[enrollment.estudiante_id]}
                                    {@const status = getStudentStatus(enrollment, activeModule.modulo_index - 1)}
                                    <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <p class="font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                                                {student?.nombre || 'Cargando...'}
                                                {#if (student as any)?.isDeleted}
                                                    <span class="px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] rounded-md uppercase font-bold tracking-wider">Fantasma</span>
                                                {/if}
                                            </p>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {student?.registro || '--'} / {student?.carnet || '--'}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-center">
                                            <span class={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-right">
                                            <div class="flex items-center justify-end gap-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    bind:value={calificacionInputs[enrollment._id]}
                                                    disabled={(student as any)?.isDeleted}
                                                    class="w-20 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white text-center font-medium placeholder-gray-300 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                    placeholder="--"
                                                />
                                                <Button 
                                                    size="sm"
                                                    loading={savingCalificacion[enrollment._id]}
                                                    onclick={() => saveCalificacion(enrollment._id, true)}
                                                    disabled={calificacionInputs[enrollment._id] === '' || (student as any)?.isDeleted}
                                                >
                                                    Guardar
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>
        {/if}
	{/if}
</div>