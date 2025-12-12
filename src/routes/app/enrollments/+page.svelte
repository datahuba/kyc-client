<script lang="ts">
	import { onMount } from 'svelte';
	import { enrollmentService, studentService, courseService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import type { Enrollment, Student, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import EnrollmentForm from '$lib/features/enrollments/EnrollmentForm.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';

	let enrollments: Enrollment[] = [];
	let studentsMap: Record<string, Student> = {};
	let coursesMap: Record<string, Course> = {};
	let loading = false;
	let error = '';
	let skip = 0;
	let limit = 100;

	// Modal state
	let isFormOpen = false;
	let selectedEnrollment: Enrollment | null = null;
	let showDeleteModal = false;
	let enrollmentToDelete: Enrollment | null = null;
	let deleteLoading = false;

	// Dropdown state
	let openDropdownId: string | null = null;

	let studentsList: Student[] = [];
	let coursesList: Course[] = [];

	onMount(() => {
		loadData();
	});

	async function loadData() {
	loading = true;

	try {
		let enrollmentsPromise;

		// Condición clásica
		if ($userStore.role === 'student') {
			enrollmentsPromise = enrollmentService.getByStudentId(
				$userStore.user?._id || ''
			);
		} else {
			enrollmentsPromise = enrollmentService.getAll(skip, limit);
		}

		// Ejecutamos todo en paralelo
		const [enrollmentsData, studentsData, coursesData] = await Promise.all([
			enrollmentsPromise,
			studentService.getAll(0, 1000),
			courseService.getAll(0, 1000)
		]);

		enrollments = enrollmentsData;
		studentsList = studentsData;
		coursesList = coursesData;

		studentsData.forEach(s => (studentsMap[s._id] = s));
		coursesData.forEach(c => (coursesMap[c._id] = c));

	} catch (e: any) {
		error = e.message || 'Error al cargar inscripciones';
		alert('error', error);
	} finally {
		loading = false;
	}
}


	function handleCreate() {
		selectedEnrollment = null;
		isFormOpen = true;
	}

	function handleEdit(enrollment: Enrollment) {
		selectedEnrollment = enrollment;
		isFormOpen = true;
	}

	function confirmDelete(enrollment: Enrollment) {
		enrollmentToDelete = enrollment;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (!enrollmentToDelete) return;
		deleteLoading = true;
		try {
			await enrollmentService.delete(enrollmentToDelete._id);
			alert('success', 'Inscripción eliminada correctamente');
			enrollments = enrollments.filter(e => e._id !== enrollmentToDelete!._id);
			showDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar inscripción');
		} finally {
			deleteLoading = false;
			enrollmentToDelete = null;
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadData();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(enrollment: Enrollment) {
		return [
			{
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(enrollment)
			},
			{
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(enrollment),
				divider: true
			}
		];
	}

	function getStudentName(id: string) {
		return studentsMap[id]?.nombre || 'Desconocido';
	}

	function getCourseName(id: string) {
		return coursesMap[id]?.nombre_programa || 'Desconocido';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Inscripciones</Heading>
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nueva Inscripción
		</Button>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={5} />
	{:else if enrollments.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay inscripciones registradas.</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class=" divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Curso</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montos</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descuento</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
						<th scope="col" class="relative px-6 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each enrollments as enrollment}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{getStudentName(enrollment.estudiante_id)}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">{enrollment.es_estudiante_interno}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{getCourseName(enrollment.curso_id)}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{new Date(enrollment.fecha_inscripcion).toLocaleDateString()}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-500 dark:text-gray-400">Total: {enrollment.total_a_pagar}</div>
								<div class="text-xs text-green-600 dark:text-green-400">Pagado: {enrollment.total_pagado}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class={`text-sm font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
									{enrollment.saldo_pendiente}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`}>
									{enrollment.es_estudiante_interno}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-green-800`}>
									{enrollment.descuento_personalizado}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enrollment.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
									{enrollment.estado}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(enrollment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
									<DotsVerticalIcon class="size-5" />
								</button>
								{#if openDropdownId === enrollment._id}
									<div class="absolute right-0 mt-2 w-48 z-10">
										<DropdownMenu 
											options={getDropdownOptions(enrollment)} 
											isOpen={true} 
											width="w-48" 
											class="origin-top-right right-0"
										/>
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Cards -->
		<div class="md:hidden grid grid-cols-1 gap-4">
			{#each enrollments as enrollment}
				<Card>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white">{getStudentName(enrollment.estudiante_id)}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">{getCourseName(enrollment.curso_id)}</p>
						</div>
						<div class="relative">
							<button onclick={() => toggleDropdown(enrollment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
								<DotsVerticalIcon class="size-5" />
							</button>
							{#if openDropdownId === enrollment._id}
								<div class="absolute right-0 mt-2 w-48 z-10">
									<DropdownMenu 
										options={getDropdownOptions(enrollment)} 
										isOpen={true} 
										width="w-48" 
										class="origin-top-right right-0"
									/>
								</div>
							{/if}
						</div>
					</div>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Fecha:</span>
							<span class="font-medium text-gray-900 dark:text-white">{new Date(enrollment.fecha_inscripcion).toLocaleDateString()}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Total:</span>
							<span class="font-medium text-gray-900 dark:text-white">{enrollment.total_a_pagar}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Saldo:</span>
							<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
								{enrollment.saldo_pendiente}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Estado:</span>
							<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enrollment.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
								{enrollment.estado}
							</span>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<!-- Create/Edit Modal -->
	<Modal
		isOpen={isFormOpen}
		title={selectedEnrollment ? 'Editar Inscripción' : 'Nueva Inscripción'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<EnrollmentForm
			enrollment={selectedEnrollment}
			students={studentsList}
			courses={coursesList}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar esta inscripción? Esta acción no se puede deshacer.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			enrollmentToDelete = null;
		}}
		loading={deleteLoading}
	/>
</div>
