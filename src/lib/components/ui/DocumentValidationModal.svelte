<script lang="ts">
	import { slide, fade } from 'svelte/transition';
	import { XIcon, CheckCircleIcon, StopwatchIcon } from '$lib/icons/outline';
	import Button from '$lib/components/ui/button.svelte';
	import { enrollmentService, studentService, courseService } from '$lib/services';
	import type { Enrollment } from '$lib/interfaces';
	import { goto } from '$app/navigation';

	export let isOpen = false;
	export let onClose: () => void;

	let loading = true;
	let enrollments: (Enrollment & { studentName?: string; courseName?: string })[] = [];
	
	$: if (isOpen) {
		loadPendingDocuments();
	}

	async function loadPendingDocuments() {
		loading = true;
		try {
			// Fetches all enrollments that require document action
			const res = await enrollmentService.getAll(1, 50, { requiere_accion_documentos: true });
			
			// Resolve names
			const studentsReq = await studentService.getAll(1, 100);
			const coursesReq = await courseService.getAll();
			
			const studentsMap = studentsReq.data.reduce((acc, s) => ({ ...acc, [s._id]: s.nombre }), {} as Record<string, string>);
			const coursesMap = coursesReq.data.reduce((acc, c) => ({ ...acc, [c._id]: c.nombre_programa }), {} as Record<string, string>);
			
			enrollments = res.data.map(e => ({
				...e,
				studentName: studentsMap[e.estudiante_id] || 'Estudiante Desconocido',
				courseName: coursesMap[e.curso_id] || 'Programa Desconocido'
			}));
		} catch (error) {
			console.error("Error loading pending documents", error);
		} finally {
			loading = false;
		}
	}

	function goToEnrollment(id: string) {
		onClose();
		goto(`/app/enrollments?q=${id}`);
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div 
		class="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm transition-opacity flex items-center justify-center p-4"
		onclick={onClose}
		transition:fade={{ duration: 150 }}
	>
		<div 
			class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			transition:slide={{ duration: 250, axis: 'y' }}
		>
			<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
						<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
					</div>
					<div>
						<h2 class="text-lg font-bold text-gray-800 dark:text-gray-200">Validación de Documentos</h2>
						<p class="text-xs text-gray-500 dark:text-gray-400">Solicitudes pendientes de revisión o subida</p>
					</div>
				</div>
				<button onclick={onClose} class="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
					<XIcon class="size-5" />
				</button>
			</div>
			
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
				{#if loading}
					<div class="flex flex-col items-center justify-center py-12 text-gray-400">
						<svg class="animate-spin size-8 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
						<p class="text-sm">Buscando solicitudes pendientes...</p>
					</div>
				{:else if enrollments.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<div class="size-16 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
							<CheckCircleIcon class="size-8" />
						</div>
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">¡Todo al día!</h3>
						<p class="text-gray-500 dark:text-gray-400 max-w-sm mt-2">No hay documentos pendientes de revisión o subida.</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each enrollments as enr}
							<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
								<div class="flex-1 min-w-0">
									<h4 class="font-bold text-gray-900 dark:text-white truncate">{enr.studentName}</h4>
									<p class="text-xs text-primary-600 dark:text-primary-400 font-medium truncate">{enr.courseName}</p>
									
									<div class="mt-3 flex flex-wrap gap-2">
										{#each (enr.requisitos || []).filter(r => r.estado !== 'aprobado') as req}
											<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium {req.estado === 'pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'} border {req.estado === 'pendiente' ? 'border-amber-200 dark:border-amber-800' : 'border-gray-200 dark:border-gray-600'}">
												{#if req.estado === 'pendiente'}
													<StopwatchIcon class="size-3" /> Revisión
												{:else if req.estado === 'sin_subir'}
													Falta subir
												{:else}
													Rechazado
												{/if}
												<span class="opacity-50 ml-1">|</span> <span class="truncate max-w-[120px]" title={req.descripcion}>{req.descripcion}</span>
											</span>
										{/each}
									</div>
								</div>
								
								<div class="shrink-0 flex items-center">
									<Button variant="secondary" size="sm" onclick={() => goToEnrollment(enr._id)} class="w-full sm:w-auto">
										Ir al Kardex
										<svg class="size-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			
			<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end">
				<Button variant="outline" onclick={onClose}>Cerrar</Button>
			</div>
		</div>
	</div>
{/if}
