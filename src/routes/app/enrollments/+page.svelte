<script lang="ts">
	import { onMount } from 'svelte';
	import { enrollmentService, studentService, courseService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import type { Enrollment, Student, Course } from '$lib/interfaces';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import EnrollmentForm from '$lib/features/enrollments/EnrollmentForm.svelte';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';
	import { alert, formatDate, formatCurrency } from '$lib/utils';
	
	let enrollments: Enrollment[] = $state([]);
	let studentsMap: Record<string, Student> = $state({});
	let coursesMap: Record<string, Course> = $state({});
	let loading = $state(false);
	let error = $state('');

	// Pagination state
	let page: number = $state(1);
	let limit: number = $state(10);
	let totalItems: number = $state(0);
	let totalPages: number = $state(1);

	// Filter state
	let filters = {
		q: '',
		estado: 'all',
		curso_id: 'all',
		estudiante_id: 'all'
	};
	let debounceTimer: any;

	// Modal state
	let isFormOpen: boolean = $state(false);
	let selectedEnrollment: Enrollment | null = $state(null);
	let showDeleteModal: boolean = $state(false);
	let enrollmentToDelete: Enrollment | null = $state(null);
	let deleteLoading: boolean = $state(false);

	// ISSUE P: Kardex Académico State
	let isKardexOpen: boolean = $state(false);
	let selectedKardex: Enrollment | null = $state(null);

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	let studentsList: Student[] = $state([]);
	let coursesList: Course[] = $state([]);

	// ISSUE N: Control de Permisos Visuales (RBAC Frontend)
	let currentRole = $derived($userStore.role || $userStore.user?.rol || '');
	let canCreateEnrollment = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canEditEnrollment = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canDeleteEnrollment = $derived(currentRole === 'superadmin');

	onMount(() => {
		if (!$userStore.isAuthenticated) {
			userStore.init();
		}
		loadData();
	});

	async function loadData() {
		loading = true;

		try {
			if (studentsList.length === 0 && currentRole !== 'student') {
				const studentsRes = await studentService.getAll(1, 100); 
				studentsList = studentsRes.data;
				studentsRes.data.forEach(s => (studentsMap[s._id] = s));
			}

			if (coursesList.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				coursesList = coursesRes.data;
				coursesRes.data.forEach(c => (coursesMap[c._id] = c));
			}

			let enrollmentsPromise;
			if (currentRole === 'student') {
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

			if (currentRole === 'student') {
				enrollments = Array.isArray(result) ? result : (result as any).data; 
			} else {
				const response = result as any; 
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

	function handleViewKardex(enrollment: Enrollment) {
		selectedKardex = enrollment;
		isKardexOpen = true;
		openDropdownId = null;
	}

	function confirmDelete(enrollment: Enrollment) {
		enrollmentToDelete = enrollment;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (!enrollmentToDelete) return;
		deleteLoading = true;
		
		const idToDelete = enrollmentToDelete._id;
		
		try {
			await enrollmentService.delete(idToDelete);
			alert('success', 'Inscripción eliminada correctamente. Referencias limpiadas.');
			enrollments = enrollments.filter(e => e._id !== idToDelete);
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
		// ISSUE P: La libreta es visible para TODOS (Estudiantes, Docentes y Administrativos)
		const options: any[] = [
			{
				label: 'Ver Libreta / Notas',
				id: 'kardex',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
				action: () => handleViewKardex(enrollment)
			}
		];

        if (currentRole === 'student') return options;

		if (canEditEnrollment) {
			options.push({
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(enrollment)
			});
		}

		if (canDeleteEnrollment) {
			options.push({
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(enrollment),
				divider: true
			});
		}

		return options;
	}

	function getStudentName(id: string) {
		if (currentRole === 'student' && $userStore.user) {
			return $userStore.user.nombre || $userStore.user.username || $userStore.user.email || 'Mi Usuario';
		}
		return studentsMap[id]?.nombre || 'Desconocido';
	}
	
	function getCourseName(id: string) {
		return coursesMap[id]?.nombre_programa || 'Desconocido';
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'activo': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'pendiente_pago': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'suspendido': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
			case 'completado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
			case 'cancelado': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Inscripciones</Heading>
		{#if canCreateEnrollment}
			<Button onclick={handleCreate}>
				{#snippet leftIcon()}
					<PlusIcon class="size-5" />
				{/snippet}
				Nueva Inscripción
			</Button>
		{/if}
	</div>

	{#if currentRole !== 'student'}
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
		<TableSkeleton columns={9} rows={10} />
	{:else if enrollments.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay inscripciones registradas.</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
			<table class="divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Curso</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pagado</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dto. Curso</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dto. Personal</th>
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
						
						<!-- Acciones siempre visibles porque todos tienen la Libreta -->
						<th scope="col" class="relative px-4 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each enrollments as enrollment (enrollment._id)}
						<tr>
							<td class="px-4 py-4">
								<div class="text-sm font-medium text-gray-900 dark:text-white max-w-[180px] break-words">
									{getStudentName(enrollment.estudiante_id)}
								</div>
							</td>
							<td class="px-4 py-4">
								<div class="text-sm text-gray-900 dark:text-white max-w-[280px] break-words" title={getCourseName(enrollment.curso_id)}>
									{getCourseName(enrollment.curso_id)}
								</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-600 dark:text-white">{formatDate(enrollment.fecha_inscripcion)}</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-600 dark:text-gray-400">{formatCurrency(enrollment.total_a_pagar)}</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<div class="text-xs text-green-600 dark:text-green-400">{formatCurrency(enrollment.total_pagado)}</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<div class="text-sm font-semibold text-red-600 dark:text-red-400">
									{formatCurrency(enrollment.saldo_pendiente)}
								</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap text-center">
								<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-green-800 bg-green-50">
									{enrollment.descuento_curso_aplicado || 0}%
								</span>
							</td>
							<td class="px-4 py-4 whitespace-nowrap text-center">
								<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-green-800 bg-green-50">
									{formatCurrency(enrollment.descuento_personalizado || 0)}
								</span>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(enrollment.estado)}`}>
									{enrollment.estado}
								</span>
							</td>
							
							<td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium relative">
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

		{#if currentRole !== 'student'}
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
			{#each enrollments as enrollment (enrollment._id)}
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
							<span class="font-medium text-gray-900 dark:text-white">{formatDate(enrollment.fecha_inscripcion)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Total:</span>
							<span class="font-medium text-gray-900 dark:text-white">{formatCurrency(enrollment.total_a_pagar)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Saldo:</span>
							<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
								{formatCurrency(enrollment.saldo_pendiente)}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Estado:</span>
							<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(enrollment.estado)}`}>
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

	<!-- ISSUE P: Modal de Libreta / Kardex -->
	<Modal
		isOpen={isKardexOpen}
		title="Libreta Académica y Financiera"
		onClose={() => isKardexOpen = false}
		maxWidth="sm:max-w-5xl"
	>
		{#if selectedKardex}
			<div class="p-6 space-y-6">
				<!-- Cabecera de la Libreta -->
				<div class="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Programa</p>
						<p class="text-lg font-bold text-slate-900 dark:text-white leading-tight">{getCourseName(selectedKardex.curso_id)}</p>
						{#if currentRole !== 'student'}
							<p class="text-sm text-blue-600 font-semibold mt-1">Estudiante: {getStudentName(selectedKardex.estudiante_id)}</p>
						{/if}
					</div>
					<div class="text-left md:text-right bg-white dark:bg-slate-900 px-6 py-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
						<p class="text-xs text-slate-500 uppercase tracking-wider font-bold">Promedio General</p>
						<p class={`text-3xl font-black mt-1 ${selectedKardex.nota_final && selectedKardex.nota_final >= 64 ? 'text-green-600' : selectedKardex.nota_final ? 'text-red-600' : 'text-slate-400'}`}>
							{selectedKardex.nota_final !== null && selectedKardex.nota_final !== undefined ? selectedKardex.nota_final : '--'}
						</p>
					</div>
				</div>

				<!-- Tabla de Módulos (Notas y Pagos) -->
				<div class="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
					<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
						<thead class="bg-slate-100 dark:bg-slate-900">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Módulo</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/10">Nota Final</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/10">Situación</th>
								<th class="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Costo (Bs)</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Pago</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
							{#if selectedKardex.modulos && selectedKardex.modulos.length > 0}
								{#each selectedKardex.modulos as mod}
									<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
										<td class="px-4 py-4 text-sm font-medium text-slate-900 dark:text-white max-w-[200px]" title={mod.nombre}>
											{mod.nombre}
										</td>
										
										<!-- Columna Académica -->
										<td class="px-4 py-4 text-center bg-blue-50/10 dark:bg-blue-900/5">
											<span class={`text-lg font-black ${mod.nota !== null && mod.nota !== undefined && mod.nota >= 64 ? 'text-green-600 dark:text-green-400' : mod.nota !== null && mod.nota !== undefined ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
												{mod.nota !== null && mod.nota !== undefined ? mod.nota : '--'}
											</span>
										</td>
										<td class="px-4 py-4 text-center bg-blue-50/10 dark:bg-blue-900/5">
											<span class={`px-3 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-wide ${mod.estado_academico === 'Aprobado' ? 'bg-green-100 text-green-700 border border-green-200' : mod.estado_academico === 'Reprobado' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
												{mod.estado_academico || 'Cursando'}
											</span>
										</td>

										<!-- Columna Financiera -->
										<td class="px-4 py-4 text-right text-sm text-slate-600 dark:text-slate-300">
											<div class="font-bold text-slate-900 dark:text-white">{formatCurrency(mod.costo)}</div>
											<div class="text-xs text-emerald-600 font-medium mt-0.5">Pagado: {formatCurrency(mod.monto_pagado || 0)}</div>
										</td>
										<td class="px-4 py-4 text-center">
											<span class={`px-2.5 py-1 text-xs font-bold rounded-full ${mod.estado === 'Pagado' ? 'bg-emerald-100 text-emerald-700' : mod.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
												{mod.estado || 'Pendiente'}
											</span>
										</td>
									</tr>
								{/each}
							{:else}
								<tr>
									<td colspan="5" class="px-4 py-8 text-center text-slate-500">
										No hay módulos registrados en esta inscripción.
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>

				<div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
					<!-- Si es estudiante y debe dinero, mostrar atajo rápido al pago -->
					{#if currentRole === 'student' && selectedKardex.saldo_pendiente > 0}
						<Button onclick={() => goto('/app/payments')} class="bg-blue-600 hover:bg-blue-700 text-white">
							Pagar Saldo Pendiente
						</Button>
					{/if}
					<Button variant="secondary" onclick={() => isKardexOpen = false}>Cerrar Libreta</Button>
				</div>
			</div>
		{/if}
	</Modal>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar esta inscripción? El estudiante y sus pagos registrados se mantendrán en el sistema por motivos de auditoría, pero perderá el acceso y progreso académico de este curso.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			enrollmentToDelete = null;
		}}
		loading={deleteLoading}
	/>
</div>
