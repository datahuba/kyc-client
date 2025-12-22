<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService } from '$lib/services';
	import type { Course, CourseStudent } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import CourseForm from '$lib/features/courses/CourseForm.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';

	let courses: Course[] = $state([]);
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
		activo: 'all', // 'all', 'true', 'false'
		tipo_curso: 'all',
		modalidad: 'all'
	};
	let debounceTimer: any;

	// Modal state
	let isFormOpen = $state(false);
	let selectedCourse: Course | null = $state(null);
	let showDeleteModal = $state(false);
	let courseToDelete: Course | null = $state(null);
	let deleteLoading = $state(false);

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	// Students Modal state
	let showStudentsModal = $state(false);
	let studentsLoading = $state(false);
	let courseStudents: CourseStudent[] = $state([]);
	let selectedCourseStudents: Course | null = $state(null);

	onMount(() => {
		loadCourses();
	});

	async function loadCourses() {
		loading = true;
		try {
			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.activo !== 'all') filterParams.activo = filters.activo === 'true';
			if (filters.tipo_curso !== 'all') filterParams.tipo_curso = filters.tipo_curso;
			if (filters.modalidad !== 'all') filterParams.modalidad = filters.modalidad;

			const response = await courseService.getAll(page, limit, filterParams);
			
			if (response && response.data) {
				courses = response.data;
				totalItems = response.meta.totalItems;
				totalPages = response.meta.totalPages;
			} else {
				courses = [];
				totalItems = 0;
			}
		} catch (e: any) {
			error = e.message || 'Error al cargar cursos';
			alert('error', error);
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadCourses();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadCourses();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadCourses();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadCourses();
	}

	async function handleViewStudents(course: Course) {
		selectedCourseStudents = course;
		showStudentsModal = true;
		studentsLoading = true;
		courseStudents = [];
		try {
			courseStudents = await courseService.getStudents(course._id);
		} catch (e: any) {
			alert('error', 'Error al cargar estudiantes del curso');
			console.error(e);
		} finally {
			studentsLoading = false;
		}
	}

	function handleCreate() {
		selectedCourse = null;
		isFormOpen = true;
	}

	function handleEdit(course: Course) {
		selectedCourse = course;
		isFormOpen = true;
	}

	function confirmDelete(course: Course) {
		courseToDelete = course;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (!courseToDelete) return;
		deleteLoading = true;
		try {
			await courseService.delete(courseToDelete._id);
			alert('success', 'Curso eliminado correctamente');
			courses = courses.filter(c => c._id !== courseToDelete!._id);
			showDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar curso');
		} finally {
			deleteLoading = false;
			courseToDelete = null;
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadCourses();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(course: Course) {
		return [
			{
				label: 'Ver Estudiantes',
				id: 'students',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
				action: () => handleViewStudents(course)
			},
			{
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(course)
			},
			{
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(course),
				divider: true
			}
		];
	}
</script>

	<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Cursos</Heading>
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nuevo Curso
		</Button>
	</div>

	<!-- Filters -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
		<!-- Search -->
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
					placeholder="Buscar código o nombre..."
					oninput={handleSearchInput}
				/>
			</div>
		</div>
		
		<!-- Estado -->
		<div>
			<select
				bind:value={filters.activo}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="all">Todos los estados</option>
				<option value="true">Activo</option>
				<option value="false">Inactivo</option>
			</select>
		</div>

		<!-- Tipo -->
		<div>
			<select
				bind:value={filters.tipo_curso}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="all">Todos los tipos</option>
				<option value="curso">Curso</option>
				<option value="taller">Taller</option>
				<option value="diplomado">Diplomado</option>
				<option value="maestria">Maestría</option>
				<option value="doctorado">Doctorado</option>
				<option value="otro">Otro</option>
			</select>
		</div>

		<!-- Modalidad -->
		<div>
			<select
				bind:value={filters.modalidad}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="all">Todas las modalidades</option>
				<option value="presencial">Presencial</option>
				<option value="virtual">Virtual</option>
				<option value="híbrido">Híbrido</option>
			</select>
		</div>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={10} />
	{:else if courses.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay cursos registrados.</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código/Prog.</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalles</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costos Int.</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costos Ext.</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiero</th>
						
						<th scope="col" class="relative px-3 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each courses as course}
						<tr>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{course.codigo}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={course.nombre_programa}>{course.nombre_programa}</div>
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-900 dark:text-white capitalize"><span class="font-semibold">Tipo:</span> {course.tipo_curso}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 capitalize"><span class="font-semibold">Mod:</span> {course.modalidad}</div>						
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-900 dark:text-white">T: {course.costo_total_interno}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">M: {course.matricula_interno}</div>
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-900 dark:text-white">T: {course.costo_total_externo}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">M: {course.matricula_externo}</div>
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-900 dark:text-white">Cuotas: {course.cantidad_cuotas}</div>
								<div class="text-xs text-green-600 dark:text-green-400">Desc: {course.descuento_curso}%</div>
							</td>
							
							<td class="px-3 py-4 whitespace-nowrap text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(course._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
									<DotsVerticalIcon class="size-5" />
								</button>
								{#if openDropdownId === course._id}
									<div class="absolute right-0 mt-2 w-48 z-10">
										<DropdownMenu 
											options={getDropdownOptions(course)} 
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
		
		<Pagination
			currentPage={page}
			{totalPages}
			{totalItems}
			{limit}
			onPageChange={handlePageChange}
			onLimitChange={handleLimitChange}
		/>

		<!-- Mobile Cards -->
		<div class="md:hidden grid grid-cols-1 gap-4">
			{#each courses as course}
				<Card>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white">{course.nombre_programa}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">{course.codigo}</p>
						</div>
						<div class="relative">
							<button onclick={() => toggleDropdown(course._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
								<DotsVerticalIcon class="size-5" />
							</button>
							{#if openDropdownId === course._id}
								<div class="absolute right-0 mt-2 w-48 z-10">
									<DropdownMenu 
										options={getDropdownOptions(course)} 
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
							<span class="text-gray-500 dark:text-gray-400">Modalidad:</span>
							<span class="font-medium text-gray-900 dark:text-white capitalize">{course.modalidad}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Inicio:</span>
							<span class="font-medium text-gray-900 dark:text-white">{new Date(course.fecha_inicio).toLocaleDateString()}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Estado:</span>
							<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${course.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
								{course.activo ? 'Activo' : 'Inactivo'}
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
		title={selectedCourse ? 'Editar Curso' : 'Nuevo Curso'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<CourseForm
			course={selectedCourse}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar el curso ${courseToDelete?.nombre_programa}? Esta acción no se puede deshacer.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			courseToDelete = null;
		}}
		loading={deleteLoading}
	/>

	<!-- Course Students Modal -->
	<Modal
		isOpen={showStudentsModal}
		title={`Estudiantes Inscritos - ${selectedCourseStudents?.nombre_programa || ''}`}
		onClose={() => { showStudentsModal = false; selectedCourseStudents = null; }}
		maxWidth="sm:max-w-6xl"
	>
		{#if studentsLoading}
			<TableSkeleton columns={4} rows={5} />
		{:else if courseStudents.length === 0}
			<div class="text-center py-12">
				<p class="text-gray-500 dark:text-gray-400">No hay estudiantes inscritos en este curso.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-900">
						<tr>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contacto</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inscripción</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiero</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{#each courseStudents as student}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										<div class="size-10 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
											<span class="text-lg font-medium text-primary-600">
												{student.nombre.charAt(0).toUpperCase()}
											</span>
										</div>
										<div class="ml-4">
											<div class="text-sm font-medium text-gray-900 dark:text-white">{student.nombre}</div>
											<div class="text-sm text-gray-500 dark:text-gray-400">CI: {student.carnet}</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900 dark:text-white">{student.contacto.email}</div>
									<div class="text-sm text-gray-500 dark:text-gray-400">{student.contacto.celular}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
										${student.inscripcion.estado === 'pendiente_pago' ? 'bg-yellow-100 text-yellow-800' : 
										  student.inscripcion.estado === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
										{student.inscripcion.estado}
									</span>
									<div class="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">{student.inscripcion.tipo_estudiante}</div>
									<div class="text-xs text-gray-400 mt-0.5">{new Date(student.inscripcion.fecha_inscripcion).toLocaleDateString()}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900 dark:text-white">Total: {student.financiero.total_a_pagar}</div>
									<div class="text-xs text-green-600">Pagado: {student.financiero.total_pagado}</div>
									<div class="text-xs text-red-500">Saldo: {student.financiero.saldo_pendiente}</div>
									<div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700">
										<div class="bg-blue-600 h-1.5 rounded-full" style={`width: ${Math.min(student.financiero.avance_pago, 100)}%`}></div>
									</div>
									<div class="text-[10px] text-right text-gray-500 mt-0.5">{student.financiero.avance_pago.toFixed(1)}%</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Modal>
</div>
