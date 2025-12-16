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
	import Select from '$lib/components/ui/select.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import EnrollmentForm from '$lib/features/enrollments/EnrollmentForm.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';

	let enrollments: Enrollment[] = $state([]);
	let studentsMap: Record<string, Student> = $state({});
	let coursesMap: Record<string, Course> = $state({});
	let loading = $state(false);
	let error = $state('');

	// Pagination state
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Filter state
	let filters = {
		q: '',
		estado: 'all',
		curso_id: 'all',
		estudiante_id: 'all'
	};
	let debounceTimer: any;

	// Modal state
	let isFormOpen = $state(false);
	let selectedEnrollment: Enrollment | null = $state(null);
	let showDeleteModal = $state(false);
	let enrollmentToDelete: Enrollment | null = $state(null);
	let deleteLoading = $state(false);

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	let studentsList: Student[] = $state([]);
	let coursesList: Course[] = $state([]);

	onMount(() => {
		if (!$userStore.isAuthenticated) {
			userStore.init();
		}
		loadData();
	});

	async function loadData() {
		loading = true;

		try {
			// Populate lists for filters (Admin only) or mapping names
			// We load a batch for the filters. 
			// In a real large app we would use async select with search, but for now we load first 1000
			if (studentsList.length === 0 && $userStore.role !== 'student') {
				const studentsRes = await studentService.getAll(1, 100); // Load enough to populate map
				studentsList = studentsRes.data;
				studentsRes.data.forEach(s => (studentsMap[s._id] = s));
			}

			if (coursesList.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				coursesList = coursesRes.data;
				coursesRes.data.forEach(c => (coursesMap[c._id] = c));
			}

			// Main query
			let enrollmentsPromise;
			if ($userStore.role === 'student') {
				enrollmentsPromise = enrollmentService.getByStudentId($userStore.user?._id || '');
			} else {
				const filterParams: any = {};
				if (filters.q) filterParams.q = filters.q;
				if (filters.estado !== 'all') filterParams.estado = filters.estado;
				if (filters.curso_id !== 'all') filterParams.curso_id = filters.curso_id;
				if (filters.estudiante_id !== 'all') filterParams.estudiante_id = filters.estudiante_id;

				enrollmentsPromise = enrollmentService.getAll(page, limit, filterParams);
			}

			const result = await enrollmentsPromise;

			if ($userStore.role === 'student') {
				// Existing behavior for student: returns array directly
				// We might need to handle pagination for student in future if API changes
				// For now assuming array
				enrollments = Array.isArray(result) ? result : (result as any).data; 
				// Manually populate maps for student view if needed, or rely on them being populated above?
				// Student view usually only needs course map.
			} else {
				// Admin view: returns paginated response
				const response = result as any; // Cast for now
				if (response && response.data) {
					enrollments = response.data;
					totalItems = response.meta.totalItems;
					totalPages = response.meta.totalPages;
				} else {
					enrollments = [];
					totalItems = 0;
				}
			}

		} catch (e: any) {
			error = e.message || 'Error al cargar inscripciones';
			alert('error', error);
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadData();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadData();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadData();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadData();
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
	{#if $userStore.role !== 'student'}
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nueva Inscripción
		</Button>
		{/if}
	</div>

	{#if $userStore.role !== 'student'}
		<!-- Filters -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
			<!-- Start Search -->
			<div class="md:col-span-1">
				<label for="search" class="sr-only">Buscar</label>
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
						</svg>
					</div>
					<input
						type="text"
						id="search"
						bind:value={filters.q}
						class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						placeholder="Buscar..."
						oninput={handleSearchInput}
					/>
				</div>
			</div>
			
			<!-- Estado -->
			<div>
				<select
					bind:value={filters.estado}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los estados</option>
					<option value="pendiente_pago">Pendiente Pago</option>
					<option value="activo">Activo</option>
					<option value="suspendido">Suspendido</option>
					<option value="completado">Completado</option>
					<option value="cancelado">Cancelado</option>
				</select>
			</div>

			<!-- Curso -->
			<div>
				<select
					bind:value={filters.curso_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los cursos</option>
					{#each coursesList as course}
						<option value={course._id}>{course.nombre_programa}</option>
					{/each}
				</select>
			</div>

			<!-- Estudiante -->
			<div>
				<select
					bind:value={filters.estudiante_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los estudiantes</option>
					{#each studentsList as student}
						<option value={student._id}>{student.nombre}</option>
					{/each}
				</select>
			</div>
		</div>
	{/if}

	{#if loading}
		<TableSkeleton columns={6} rows={10} />
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

		{#if $userStore.role !== 'student'}
			<Pagination
				currentPage={page}
				{totalPages}
				{totalItems}
				{limit}
				onPageChange={handlePageChange}
				onLimitChange={handleLimitChange}
			/>
		{/if}

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
