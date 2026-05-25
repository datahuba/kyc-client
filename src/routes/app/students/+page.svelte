<script lang="ts">
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/stores';
	import { studentService, enrollmentService, courseService } from '$lib/services';
	import type { Student, Enrollment, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import StudentDetails from '$lib/features/students/StudentDetails.svelte';
	import StudentForm from '$lib/features/students/StudentForm.svelte';
	import { PlusIcon, DotsVerticalIcon, UserIcon, CheckIcon, XIcon, FileTextIcon, DownloadIcon } from '$lib/icons/outline';
	import { alert } from '$lib/utils';
	import Input from '$lib/components/ui/input.svelte';
	import { Pagination } from '$lib/components/ui';
	import { formatDate, formatCurrency } from '$lib/utils';
	import PlaneIcon from '$lib/icons/outline/planeIcon.svelte';

	let students: Student[] = $state([]);
	let loading = $state(true);
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Modal State
	let isFormOpen :boolean= $state(false);
	let isDetailsOpen :boolean= $state(false);
	let selectedStudent: Student | null = $state(null);
	let isDeleteModalOpen :boolean= $state(false);
	let studentToDelete: Student | null = $state(null);
	let deleteLoading :boolean= $state(false);
	
	// Verify/Reject State
	let isVerifyModalOpen :boolean= $state(false);
	let isRejectModalOpen :boolean= $state(false);
	let studentToAction: Student | null = $state(null);
	let actionLoading :boolean= $state(false);
	let rejectReason :string= $state('');

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	// Enrollments Modal State
	let isEnrollmentsOpen :boolean= $state(false);
	let studentEnrollments: Enrollment[] = $state([]);
	let enrollmentsLoading :boolean= $state(false);

	// IMPORTACIÓN EXCEL STATE
	let isImportModalOpen: boolean = $state(false);
	let importFile: File | null = $state(null);
	let importLoading = $state(false);
	let importReport: { success_count: number; errors: string[] } | null = $state(null);

	// SELECCIÓN MÚLTIPLE Y BORRADO EN LOTE STATE (NUEVO)
	let selectedStudentIds: string[] = $state([]);
	let showBulkDeleteModal = $state(false);
	let bulkDeleteLoading = $state(false);

	// Filters
	let filters = $state({
		q: '',
		activo: 'all', // 'all', 'true', 'false'
		estado_titulo: 'all',
		curso_id: ''
	});
	let debounceTimer: any;
	let allCourses: Course[] = $state([]);

	// Computed: Verificar si el rol es SuperAdmin para controles de borrado masivo
	let isSuperAdmin = $derived($userStore.role === 'superadmin');

	// Computed: Verificar si todos los estudiantes de la página actual están seleccionados
	let isAllSelected = $derived(
		students.length > 0 && students.every(s => selectedStudentIds.includes(s._id))
	);

	function toggleSelectAll() {
		if (isAllSelected) {
			// Deseleccionar los estudiantes de la página actual
			selectedStudentIds = selectedStudentIds.filter(id => !students.some(s => s._id === id));
		} else {
			// Seleccionar todos los estudiantes de la página actual sin duplicar
			const currentIds = students.map(s => s._id);
			selectedStudentIds = [...new Set([...selectedStudentIds, ...currentIds])];
		}
	}

	function toggleSelectStudent(id: string) {
		if (selectedStudentIds.includes(id)) {
			selectedStudentIds = selectedStudentIds.filter(item => item !== id);
		} else {
			selectedStudentIds = [...selectedStudentIds, id];
		}
	}

	async function handleBulkDelete() {
		if (selectedStudentIds.length === 0) return;
		bulkDeleteLoading = true;
		try {
			const response = await studentService.bulkDelete(selectedStudentIds);
			alert('success', response.message || `Se eliminaron ${selectedStudentIds.length} estudiantes.`);
			
			// Actualización reactiva instantánea SPA (Filtramos localmente los borrados)
			students = students.filter(s => !selectedStudentIds.includes(s._id));
			selectedStudentIds = []; // Limpiar selección
			showBulkDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al realizar la eliminación masiva');
		} finally {
			bulkDeleteLoading = false;
		}
	}

	async function loadCourses() {
		try {
			if (allCourses.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				allCourses = coursesRes.data;
			}
			
		} catch (error) {
			console.error('Error fetching courses for filter', error);
		}
	}

	async function loadStudents() {
		loading = true;
		try {
			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.activo !== 'all') filterParams.activo = filters.activo === 'true';
			if (filters.estado_titulo !== 'all') filterParams.estado_titulo = filters.estado_titulo;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;

			const response = await studentService.getAll(page, limit, filterParams);
			console.log("students response", response);
			
			if (response && response.data) {
				students = response.data;
				totalItems = response.meta.totalItems;
				totalPages = response.meta.totalPages;
			} else {
				students = [];
				totalItems = 0;
			}
		} catch (error) {
			console.error(error);
			alert('error', 'Error al cargar estudiantes');
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		loadStudents();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1; // Reset to page 1 on search
			loadStudents();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadStudents();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1; // Reset to first page
		loadStudents();
	}

	onMount(async () => {
		try {
			const coursesRes = await courseService.getAll(1, 100);
			allCourses = coursesRes.data;
		} catch (e) { console.error('Error loading courses', e); }

		const cursoIdParam = $appPage.url.searchParams.get('curso_id');
		if (cursoIdParam) {
			filters.curso_id = cursoIdParam;
		}
		loadStudents();
	});

	function handleCreate() {
		selectedStudent = null;
		isFormOpen = true;
	}

	function handleEdit(student: Student) {
		selectedStudent = student;
		isFormOpen = true;
	}

	function handleViewDetails(student: Student) {
		selectedStudent = student;
		isDetailsOpen = true;
	}

	function handleDeleteClick(student: Student) {
		studentToDelete = student;
		isDeleteModalOpen = true;
		openDropdownId = null;
	}

	async function confirmDelete() {
		if (!studentToDelete) return;
		deleteLoading = true;
		const idToDelete = studentToDelete._id;
		try {
			await studentService.delete(idToDelete);
			alert('success', 'Estudiante eliminado correctamente');
			isDeleteModalOpen = false;
			students = students.filter(s => s._id !== idToDelete);
		} catch (error: any) {
			alert('error', error.message || 'Error al eliminar estudiante');
		} finally {
			deleteLoading = false;
			studentToDelete = null;
		}
	}

	async function confirmVerify() {
		if (!studentToAction) return;
		actionLoading = true;
		const idToVerify = studentToAction._id;
		try {
			await studentService.verifyTitulo(idToVerify, {});
			alert('success', 'Título verificado correctamente');
			isVerifyModalOpen = false;
			
			students = students.map(s => 
				s._id === idToVerify 
					? { ...s, titulo: s.titulo ? { ...s.titulo, estado: 'verificado' } : undefined } 
					: s
			);
		} catch (error: any) {
			alert('error', error.message || 'Error al verificar título');
		} finally {
			actionLoading = false;
			studentToAction = null;
		}
	}

	async function confirmReject() {
		if (!studentToAction) return;
		if (!rejectReason.trim()) {
			alert('error', 'Debe ingresar un motivo de rechazo');
			return;
		}
		actionLoading = true;
		const idToReject = studentToAction._id;
		const reason = rejectReason;
		try {
			await studentService.rejectTitulo(idToReject, reason);
			alert('success', 'Título rechazado correctamente');
			isRejectModalOpen = false;
			
			students = students.map(s => 
				s._id === idToReject 
					? { ...s, titulo: s.titulo ? { ...s.titulo, estado: 'rechazado' } : undefined } 
					: s
			);
		} catch (error: any) {
			alert('error', error.message || 'Error al rechazar título');
		} finally {
			actionLoading = false;
			studentToAction = null;
			rejectReason = '';
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadStudents();
	}

	function handleDetailsUpdate() {
		loadStudents();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function handleVerifyClick(student: Student) {
		studentToAction = student;
		isVerifyModalOpen = true;
		openDropdownId = null;
	}

	function handleRejectClick(student: Student) {
		studentToAction = student;
		rejectReason = '';
		isRejectModalOpen = true;
		openDropdownId = null;
	}

	async function handleViewEnrollments(student: Student) {
		selectedStudent = student;
		isEnrollmentsOpen = true;
		enrollmentsLoading = true;
		studentEnrollments = [];
		openDropdownId = null;
		try {
			studentEnrollments = await enrollmentService.getByStudentId(student._id);
		} catch (error) {
			console.error(error);
			alert('error', 'Error al cargar inscripciones del estudiante');
		} finally {
			enrollmentsLoading = false;
		}
	}

	function getDropdownOptions(student: Student) {
		const options = [
			{
				label: 'Ver Detalles',
				id: 'details',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`,
				action: () => handleViewDetails(student)
			},
			{
				label: 'Ver Inscripciones',
				id: 'enrollments',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
				action: () => handleViewEnrollments(student)
			},
			{
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(student)
			},
			{
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => handleDeleteClick(student),
				divider: true
			}
		];

		if (student.titulo && student.titulo.estado !== 'verificado') {
			options.splice(1, 0, {
				label: 'Verificar Título',
				id: 'verify',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => handleVerifyClick(student)
			} as any);
		}

		if (student.titulo && student.titulo.estado !== 'rechazado') {
			options.splice(options.length - 1, 0, {
				label: 'Rechazar Título',
				id: 'reject',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => handleRejectClick(student)
			} as any);
		}

		return options;
	}

	let csvLoading = $state(false);

	async function downloadStudentsCSV() {
		csvLoading = true;
		try {
			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.activo !== 'all') filterParams.activo = filters.activo === 'true';
			if (filters.estado_titulo !== 'all') filterParams.estado_titulo = filters.estado_titulo;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;

			const res = await studentService.getAll(1, 1000, filterParams);
			const allStudents = res.data ?? [];

			if (allStudents.length === 0) {
				alert('error', 'No hay datos para descargar');
				return;
			}

			const headers = ['Estudiante', 'Email', 'Registro', 'Carnet', 'Contacto', 'Domicilio', 'Estado', 'Título'];
			const rows = allStudents.map(s => [
				`"${s.nombre}"`,
				s.email || 'N/A',
				s.registro || 'N/A',
				s.carnet || 'N/A',
				s.celular || 'N/A',
				`"${s.domicilio || 'N/A'}"`,
				s.activo ? 'Activo' : 'Inactivo',
				s.titulo ? s.titulo.estado : 'Sin Título'
			]);

			const courseName = filters.curso_id
				? (allCourses.find(c => c._id === filters.curso_id)?.codigo ?? filters.curso_id)
				: 'todos';
			const filename = `estudiantes_${courseName}_${new Date().getTime()}.csv`;

			const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
			const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error al exportar CSV:', error);
			alert('error', 'Ocurrió un error al generar el archivo');
		} finally {
			csvLoading = false;
		}
	}

	// --- LOGICA DE IMPORTACION DESDE EXCEL ---
	async function handleImportExcelSubmit() {
		if (!importFile) {
			alert('error', 'Por favor, seleccione un archivo de Excel');
			return;
		}
		importLoading = true;
		importReport = null;
		try {
			const response = await studentService.importFromExcel(importFile);
			importReport = response;
			if (response.success_count > 0) {
				alert('success', `¡Se importaron ${response.success_count} estudiantes con éxito!`);
				loadStudents(); 
			}
			if (response.errors.length > 0) {
				alert('error', `Se detectaron ${response.errors.length} problemas en las filas.`);
			} else {
				isImportModalOpen = false;
				importFile = null;
			}
		} catch (e: any) {
			alert('error', e.message || 'Error al procesar la importación del archivo');
		} finally {
			importLoading = false;
		}
	}

	function downloadTemplateCSV() {
		const headers = ["Nombre Completo", "Registro Academico", "Carnet de Identidad", "Extension", "Email", "Celular", "Domicilio", "Tipo Estudiante"];
		const sampleRow = ["Juan Perez Gomez", "", "1234567", "SC", "juan.perez@email.com", "77012345", "Calle Falsa 123", "interno"];
		const csvContent = [headers, sampleRow].map(e => e.join(",")).join("\n");
		const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "plantilla_estudiantes.csv";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		alert('success', 'Plantilla descargada. Rellénala y súbela en formato Excel o CSV.');
	}

</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
		<Heading level="h1">Estudiantes</Heading>
		<div class="flex flex-wrap gap-3 ml-auto w-full sm:w-auto justify-end">
			<Button onclick={downloadStudentsCSV} variant="secondary" loading={csvLoading}>
				{#snippet leftIcon()}
					<DownloadIcon class="size-5" />
				{/snippet}
				Descargar CSV
			</Button>

			<!-- Botón de Importación de Excel -->
			<Button onclick={() => { isImportModalOpen = true; importReport = null; importFile = null; }} variant="secondary">
				{#snippet leftIcon()}
					<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
				{/snippet}
				Importar Excel
			</Button>

			<Button onclick={handleCreate}>
				{#snippet leftIcon()}
					<PlusIcon class="size-5" />
				{/snippet}
				Nuevo Estudiante
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<div class="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
		<!-- Search -->
		<div class="md:col-span-2">
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
					placeholder="Buscar por nombre, CI, registro..."
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

		<!-- Título -->
		<div>
			<select
				bind:value={filters.estado_titulo}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="all">Todos los títulos</option>
				<option value="pendiente">Pendiente</option>
				<option value="verificado">Verificado</option>
				<option value="rechazado">Rechazado</option>
				<option value="sin_titulo">Sin Título</option>
			</select>
		</div>

		<!-- Curso -->
		<div class="flex flex-col gap-1">
			<div class="relative">
				<select
					bind:value={filters.curso_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 pr-8 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6
						{filters.curso_id
							? 'ring-2 ring-inset ring-primary-500 bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-500'
							: 'ring-1 ring-inset ring-gray-300 dark:bg-gray-700 dark:text-white dark:ring-gray-600'}"
				>
					<option value="">Todos los cursos</option>
					{#each allCourses as course (course._id)}
						<option value={course._id}>{course.nombre_programa} ({course.codigo})</option>
					{/each}
				</select>
				{#if filters.curso_id}
					<button
						type="button"
						onclick={() => { filters.curso_id = ''; page = 1; handleFilterChange(); }}
						class="absolute right-7 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors z-10"
						title="Quitar filtro de curso"
						aria-label="Quitar filtro de curso"
					>
						<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				{/if}
			</div>
			{#if filters.curso_id}
				<span class="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
					<svg class="size-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></span
				>
			{/if}
		</div>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={10} />
	{:else}
		<div class="w-full overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm animate-fade-in">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-800">
					<tr>
						<!-- Checkbox Maestro para el SuperAdmin -->
						{#if isSuperAdmin}
							<th scope="col" class="px-6 py-3 text-left w-10">
								<input
									type="checkbox"
									checked={isAllSelected}
									onchange={toggleSelectAll}
									class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-700 cursor-pointer"
								/>
							</th>
						{/if}

						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carnet</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domicilio</th>
						<th scope="col" class="relative px-6 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
					{#each students as student (student._id)}
						<tr class={selectedStudentIds.includes(student._id) ? 'bg-primary-50/40 dark:bg-primary-950/20 transition-colors' : 'transition-colors'}>
							<!-- Checkbox Individual para el SuperAdmin -->
							{#if isSuperAdmin}
								<td class="px-6 py-4 whitespace-nowrap">
									<input
										type="checkbox"
										checked={selectedStudentIds.includes(student._id)}
										onchange={() => toggleSelectStudent(student._id)}
										class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-700 cursor-pointer"
									/>
								</td>
							{/if}

							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center">
									<div class="h-10 w-10 shrink-0">
										{#if student.foto_url}
										<img class="h-10 w-10 rounded-full object-cover" src={student.foto_url || `https://ui-avatars.com/api/?name=${student.nombre}`} alt="" />
										{:else}
										<span><UserIcon class="size-10"/></span>
										{/if}
									</div>
									<div class="ml-4">
										<div class="text-sm font-medium text-gray-900 dark:text-white">{student.nombre}</div>
										<div class="text-sm text-gray-500">{student.email}</div>
									</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.registro}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.carnet}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.celular}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.domicilio}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(student._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
									<DotsVerticalIcon class="size-5" />
								</button>
								{#if openDropdownId === student._id}
									<div class="absolute right-0 mt-2 w-48 z-10">
										<DropdownMenu 
											options={getDropdownOptions(student)} 
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
	{/if}

	<!-- Create/Edit Modal -->
	<Modal
		isOpen={isFormOpen}
		title={selectedStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-7xl"
	>
		<StudentForm
			student={selectedStudent}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<!-- Details Modal -->
	<Modal
		isOpen={isDetailsOpen}
		title="Detalles del Estudiante"
		onClose={() => isDetailsOpen = false}
		maxWidth="sm:max-w-7xl"
	>
		{#if selectedStudent}
			<StudentDetails
				student={selectedStudent}
				onUpdate={handleDetailsUpdate}
				onClose={() => isDetailsOpen = false}
			/>
		{/if}
	</Modal>

	<!-- Delete Confirmation Modal (CORREGIDO CON MENSAJE DE AUDITORÍA) -->
	<ModalConfirm
		isOpen={isDeleteModalOpen}
		message={`¿Estás seguro de que deseas eliminar al estudiante ${studentToDelete?.nombre}? El sistema borrará sus inscripciones y solo purgará sus pagos pendientes, conservando aprobados y cancelados por fines de auditoría.`}
		onConfirm={confirmDelete}
		onCancel={() => isDeleteModalOpen = false}
		loading={deleteLoading}
	/>

	<!-- Verify Confirmation Modal -->
	<ModalConfirm
		isOpen={isVerifyModalOpen}
		message={`¿Confirma que desea VERIFICAR el título del estudiante ${studentToAction?.nombre}?`}
		onConfirm={confirmVerify}
		onCancel={() => isVerifyModalOpen = false}
		loading={actionLoading}
	/>

	<!-- Reject Input Modal -->
	<Modal
		isOpen={isRejectModalOpen}
		title="Rechazar Título"
		onClose={() => isRejectModalOpen = false}
		maxWidth="sm:max-w-lg"
	>
		<div class="space-y-4 p-4">
			<p class="text-sm text-gray-500">
				Por favor ingrese el motivo por el cual se rechaza el título del estudiante <b>{studentToAction?.nombre}</b>.
			</p>
			<div>
				<label for="rejectReason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo del rechazo</label>
				<textarea
					id="rejectReason"
					bind:value={rejectReason}
					rows="3"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					placeholder="Ej: Documento ilegible, datos incorrectos..."
				></textarea>
			</div>
			<div class="flex justify-end gap-3 mt-4">
				<Button variant="secondary" onclick={() => isRejectModalOpen = false} disabled={actionLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmReject} loading={actionLoading}>Rechazar</Button>
			</div>
		</div>
	</Modal>

	<!-- Enrollments Modal -->
	<Modal
		isOpen={isEnrollmentsOpen}
		title={`Inscripciones de ${selectedStudent?.nombre || ''}`}
		onClose={() => isEnrollmentsOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<div class="p-6">
			{#if enrollmentsLoading}
				<div class="flex justify-center py-8">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
				</div>
			{:else if studentEnrollments.length === 0}
				<div class="text-center py-8 text-gray-500">
					No se encontraron inscripciones para este estudiante.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-800">
							<tr>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montos</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
							{#each studentEnrollments as enrollment (enrollment._id)}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{new Date(enrollment.fecha_inscripcion).toLocaleDateString()}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="text-xs text-gray-500">Total: {formatCurrency(enrollment.total_a_pagar)}</div>
										<div class="text-xs text-green-600">Pagado: {formatCurrency(enrollment.total_pagado)}</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
											{formatCurrency(enrollment.saldo_pendiente)}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enrollment.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
											{enrollment.estado}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			<div class="mt-6 flex justify-end">
				<Button variant="secondary" onclick={() => isEnrollmentsOpen = false}>Cerrar</Button>
			</div>
		</div>
	</Modal>

	<!-- Import Modal -->
	<Modal
		isOpen={isImportModalOpen}
		title="Importación Masiva de Estudiantes (Excel)"
		onClose={() => { if (!importLoading) isImportModalOpen = false; }}
		maxWidth="sm:max-w-2xl"
	>
		<div class="p-6 space-y-6">
			<div class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
				<p>
					Sube una hoja de cálculo con la lista de estudiantes para registrarlos en lote de manera automática.
				</p>
				<ul class="list-disc pl-5 space-y-1 text-xs text-gray-400 dark:text-gray-500">
					<li>La contraseña inicial por defecto de cada estudiante será su **Carnet de Identidad (CI)** [26].</li>
					<li><b>Regla de Negocio:</b> Si una fila no tiene <b>Registro</b>, se utilizará su <b>Email</b> como usuario de acceso para su login.</li>
				</ul>
			</div>

			<div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">¿No tienes el formato de la plantilla?</span>
				<Button onclick={downloadTemplateCSV} variant="secondary" class="text-xs py-1 px-3">
					Descargar Plantilla
				</Button>
			</div>

			<!-- Input para Subir Archivo -->
			<div class="space-y-1">
				<label for="import-file" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Selecciona el archivo (.xlsx o .xls)</label>
				<input
					id="import-file"
					type="file"
					accept=".xlsx, .xls, .csv"
					onchange={(e) => {
						const files = (e.target as HTMLInputElement).files;
						if (files && files.length > 0) {
							importFile = files[0];
						}
					}}
					class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-white"
				/>
			</div>

			<!-- Reporte de Resultados / Errores de Procesamiento -->
			{#if importReport}
				<div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3 max-h-60 overflow-y-auto">
					<h4 class="text-sm font-bold text-gray-800 dark:text-white">Reporte de Procesamiento:</h4>
					<p class="text-xs text-green-600 dark:text-green-400 font-semibold">
						✓ {importReport.success_count} estudiantes importados y creados con éxito en la base de datos.
					</p>
					
					{#if importReport.errors.length > 0}
						<div class="space-y-1">
							<p class="text-xs text-red-600 dark:text-red-400 font-semibold">⚠️ Se detectaron {importReport.errors.length} problemas en el archivo:</p>
							<ul class="list-disc pl-5 text-[11px] text-red-500 space-y-1">
								{#each importReport.errors as err}
									<li>{err}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
				<Button variant="secondary" onclick={() => isImportModalOpen = false} disabled={importLoading}>
					Cancelar
				</Button>
				<Button onclick={handleImportExcelSubmit} loading={importLoading} disabled={!importFile}>
					Procesar Importación
				</Button>
			</div>
		</div>
	</Modal>

	<!-- BARRA DE ACCIONES FLOTANTE DE SELECCIÓN MÚLTIPLE -->
	{#if selectedStudentIds.length > 0 && isSuperAdmin}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 dark:bg-gray-950/95 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-6 z-50 border border-gray-800 dark:border-gray-700 backdrop-blur-sm transition-all duration-300">
			<span class="text-sm font-semibold tracking-wider">
				{selectedStudentIds.length} estudiantes seleccionados
			</span>
			<div class="flex gap-2">
				<Button variant="secondary" class="text-xs py-1 px-3 bg-gray-800 text-white hover:bg-gray-700 border-0 transition-colors" onclick={() => selectedStudentIds = []}>
					Deseleccionar
				</Button>
				<Button variant="destructive" class="text-xs py-1 px-3 font-semibold" onclick={() => showBulkDeleteModal = true}>
					Eliminar Selección
				</Button>
			</div>
		</div>
	{/if}

	<!-- MODAL CONFIRMACIÓN ELIMINACIÓN MASIVA (CORREGIDO CON MENSAJE DE AUDITORÍA) -->
	<ModalConfirm
		isOpen={showBulkDeleteModal}
		message={`¿Estás absolutamente seguro de que deseas eliminar a los ${selectedStudentIds.length} estudiantes seleccionados? El sistema borrará sus inscripciones y solo purgará sus pagos en estado pendiente, reteniendo aprobados y rechazados por normativas de auditoría.`}
		onConfirm={handleBulkDelete}
		onCancel={() => showBulkDeleteModal = false}
		loading={bulkDeleteLoading}
	/>
</div>
