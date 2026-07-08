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
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import StudentDetails from '$lib/features/students/StudentDetails.svelte';
	import StudentForm from '$lib/features/students/StudentForm.svelte';
	import { PlusIcon, DownloadIcon } from '$lib/icons/outline';
	import { alert } from '$lib/utils';
	import { Pagination } from '$lib/components/ui';

	// Importación de Componentes Modulares
	import StudentFilters from './StudentFilters.svelte';
	import StudentTable from './StudentTable.svelte';
	import ImportModal from './ImportModal.svelte';
	import EnrollmentsModal from './EnrollmentsModal.svelte';

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

	// Importación Excel State
	let isImportModalOpen: boolean = $state(false);
	let importFile: File | null = $state(null);
	let importLoading = $state(false);
	let importReport: { success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[]; marcados_por_color?: Record<string, string[]> } | null = $state(null);
	let importTipoEstudiante: 'interno' | 'externo' = $state('externo'); 
	let importCursoId: string = $state(''); // Curso opcional para auto-inscripción en carga masiva

	// Selección Múltiple
	let selectedStudentIds: string[] = $state([]);
	let showBulkDeleteModal = $state(false);
	let bulkDeleteLoading = $state(false);

	// Toggling State
	let togglingTypeIds: Set<string> = $state(new Set());

	// Filters
	let filters = $state({
		q: '',
		activo: 'all',
		estado_titulo: 'all',
		curso_id: ''
	});
	let debounceTimer: any;
	let allCourses: Course[] = $state([]);

	// Permisos Visuales Granulares
	let currentRole = $derived($userStore.role || $userStore.user?.rol || '');
	let isSuperAdmin = $derived(currentRole === 'superadmin');
	let canCreateStudent = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canEditStudent = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canVerifyTitle = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));

	let isAllSelected = $derived(
		students.length > 0 && students.every(s => selectedStudentIds.includes(s._id))
	);

	function toggleSelectAll() {
		if (isAllSelected) {
			selectedStudentIds = selectedStudentIds.filter(id => !students.some(s => s._id === id));
		} else {
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
			students = students.filter(s => !selectedStudentIds.includes(s._id));
			selectedStudentIds = [];
			showBulkDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al realizar la eliminación masiva');
		} finally {
			bulkDeleteLoading = false;
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
			page = 1;
			loadStudents();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadStudents();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadStudents();
	}

	onMount(async () => {
		try {
			// --- OPTIMIZACIÓN: SISTEMA DE CACHÉ CLIENT-SIDE EN DIPLOMADOS/CURSOS ---
			const cachedCourses = sessionStorage.getItem('cached_courses_list');
			const cacheTimestamp = sessionStorage.getItem('cached_courses_timestamp');
			const now = new Date().getTime();
			const cacheDuration = 5 * 60 * 1000; // Validez de 5 minutos de búfer

			if (cachedCourses && cacheTimestamp && (now - Number(cacheTimestamp) < cacheDuration)) {
				allCourses = JSON.parse(cachedCourses);
			} else {
				const coursesRes = await courseService.getAll(1, 100);
				if (coursesRes && coursesRes.data) {
					allCourses = coursesRes.data;
					sessionStorage.setItem('cached_courses_list', JSON.stringify(coursesRes.data));
					sessionStorage.setItem('cached_courses_timestamp', String(now));
				}
			}
		} catch (e) { 
			console.error('Error loading courses with cache integration', e); 
		}

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
			students = students.map(s => s._id === idToVerify ? { ...s, titulo: s.titulo ? { ...s.titulo, estado: 'verificado' } : undefined } : s);
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
			students = students.map(s => s._id === idToReject ? { ...s, titulo: s.titulo ? { ...s.titulo, estado: 'rechazado' } : undefined } : s);
		} catch (error: any) {
			alert('error', error.message || 'Error al rechazar título');
		} finally {
			actionLoading = false;
			studentToAction = null;
			rejectReason = '';
		}
	}

	async function toggleStudentType(student: Student) {
		if (!canEditStudent) return; 
		const newType = student.es_estudiante_interno === 'interno' ? 'externo' : 'interno';
		
		togglingTypeIds.add(student._id);
		togglingTypeIds = new Set(togglingTypeIds); 
		
		try {
			const updatedStudent = await studentService.toggleTipoEstudiante(student._id, newType);
			students = students.map(s => s._id === student._id ? { ...s, es_estudiante_interno: updatedStudent.es_estudiante_interno } : s);
			alert('success', `El estudiante ahora es ${newType.toUpperCase()}`);
		} catch (error: any) {
			alert('error', error.message || 'Error al cambiar tipo de estudiante');
		} finally {
			togglingTypeIds.delete(student._id);
			togglingTypeIds = new Set(togglingTypeIds);
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
		isVerifyModalOpen = false; 
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
		const options: any[] = [
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
			}
		];

		if (canEditStudent) {
			options.push({
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(student)
			});
		}

		if (isSuperAdmin) {
			options.push({
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => handleDeleteClick(student),
				divider: true
			});
		}

		if (canVerifyTitle && student.titulo && student.titulo.estado !== 'verificado') {
			options.push({
				label: 'Verificar Título',
				id: 'verify',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => handleVerifyClick(student)
			} as any);
		}

		if (canVerifyTitle && student.titulo && student.titulo.estado !== 'rechazado') {
			options.push({
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

			let allStudents: Student[] = [];
			let currentPage = 1;
			let hasMore = true;
			const batchLimit = 100; 

			while (hasMore) {
				const res = await studentService.getAll(currentPage, batchLimit, filterParams);
				if (res && res.data && res.data.length > 0) {
					allStudents = [...allStudents, ...res.data];
					if (res.meta && res.meta.hasNextPage) {
						currentPage++;
					} else {
						hasMore = false;
					}
				} else {
					hasMore = false;
				}
			}

			if (allStudents.length === 0) {
				alert('error', 'No hay datos para descargar');
				return;
			}

			const headers = ['Estudiante', 'Email', 'Registro', 'Carnet', 'Contacto', 'Domicilio', 'Estado', 'Título'];
			
			const rows = allStudents.map(s => [
				`"${s.nombre || 'Sin nombre'}"`,
				s.email || 'N/A',
				s.registro || 'N/A',
				s.carnet || 'N/A',
				s.celular || 'N/A',
				`"${s.domicilio || 'N/A'}"`,
				s.activo ? 'Activo' : 'Inactivo',
				s.titulo && s.titulo.estado ? s.titulo.estado : 'Sin Título'
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

	async function handleImportExcelSubmit() {
		if (!importFile) {
			alert('error', 'Por favor, seleccione un archivo de Excel');
			return;
		}
		importLoading = true;
		importReport = null;
		try {
			const response = await studentService.importFromExcel(importFile, importTipoEstudiante, importCursoId || undefined);
			importReport = response;
			if (response.success_count > 0) {
				const inscritosMsg = response.enrolled_count > 0
					? ` y ${response.enrolled_count} inscritos al curso seleccionado`
					: '';
				const pagosParts = [];
				if (response.migrated_payments_count > 0) pagosParts.push(`${response.migrated_payments_count} con pagos migrados`);
				if (response.matricula_vouchers_count > 0) pagosParts.push(`${response.matricula_vouchers_count} comprobantes de matrícula pendientes`);
				const pagosMsg = pagosParts.length > 0 ? ` (${pagosParts.join(', ')})` : '';
				alert('success', `¡Se importaron ${response.success_count} estudiantes con éxito${inscritosMsg}${pagosMsg}!`);
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
		// Fecha de Nacimiento se interpreta como DIA/MES/AÑO (no mes/dia como
		// sugeriría un formato "mm/dd/aaaa" en inglés). Registro Académico es
		// opcional: si se deja vacío, el sistema usa el Carnet de Identidad
		// (sin el complemento tras el guion, si lo tuviera) como usuario/registro.
		const headers = ["Nombre Completo", "Registro Academico (opcional)", "Carnet de Identidad", "Extension", "Email", "Celular", "Domicilio", "Fecha de Nacimiento (DD/MM/AAAA)", "Grupo Sanguineo"];
		const sampleRow = ["Juan Perez Gomez", "", "1234567", "SC", "juan.perez@email.com", "77012345", "Calle Falsa 123", "15/08/1990", "A+"];
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

			{#if canCreateStudent}
				<Button onclick={() => { isImportModalOpen = true; importReport = null; importFile = null; importTipoEstudiante = 'externo'; importCursoId = ''; }} variant="secondary">
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
			{/if}
		</div>
	</div>

	<!-- Componente de Filtros Modularizado -->
	<StudentFilters
		bind:q={filters.q}
		bind:activo={filters.activo}
		bind:estado_titulo={filters.estado_titulo}
		bind:curso_id={filters.curso_id}
		{allCourses}
		onSearchInput={handleSearchInput}
		onFilterChange={handleFilterChange}
	/>

	{#if loading}
		<TableSkeleton columns={6} rows={10} />
	{:else}
		<!-- Componente de Tabla Modularizado -->
		<StudentTable
			{students}
			{isSuperAdmin}
			{canEditStudent}
			{togglingTypeIds}
			{getDropdownOptions}
			{toggleSelectAll}
			{toggleSelectStudent}
			{toggleStudentType}
			{toggleDropdown}
			bind:selectedStudentIds={selectedStudentIds}
			bind:openDropdownId={openDropdownId}
		/>
		
		<Pagination
			currentPage={page}
			{totalPages}
			{totalItems}
			{limit}
			onPageChange={handlePageChange}
			onLimitChange={handleLimitChange}
		/>
	{/if}

	<!-- Modales de Negocio -->
	<Modal isOpen={isFormOpen} title={selectedStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'} onClose={() => isFormOpen = false} maxWidth="sm:max-w-7xl">
		<StudentForm student={selectedStudent} onSuccess={handleFormSuccess} onCancel={() => isFormOpen = false} />
	</Modal>

	<Modal isOpen={isDetailsOpen} title="Detalles del Estudiante" onClose={() => isDetailsOpen = false} maxWidth="sm:max-w-7xl">
		{#if selectedStudent}
			<StudentDetails student={selectedStudent} onUpdate={handleDetailsUpdate} onClose={() => isDetailsOpen = false} />
		{/if}
	</Modal>

	<ModalConfirm isOpen={isDeleteModalOpen} message={`¿Estás seguro de que deseas eliminar al estudiante? El sistema borrará sus inscripciones y solo purgará sus pagos pendientes, conservando aprobados y cancelados por fines de auditoría.`} onConfirm={confirmDelete} onCancel={() => isDeleteModalOpen = false} loading={deleteLoading} />

	<ModalConfirm isOpen={isVerifyModalOpen} message={`¿Confirma que desea VERIFICAR el título del estudiante?`} onConfirm={confirmVerify} onCancel={() => isVerifyModalOpen = false} loading={actionLoading} />

	<Modal isOpen={isRejectModalOpen} title="Rechazar Título" onClose={() => isRejectModalOpen = false} maxWidth="sm:max-w-lg">
		<div class="space-y-4 p-4">
			<p class="text-sm text-gray-500">Por favor ingrese el motivo por el cual se rechaza el título del estudiante.</p>
			<div>
				<label for="rejectReason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo del rechazo</label>
				<textarea id="rejectReason" bind:value={rejectReason} rows="3" class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm" placeholder="Ej: Documento ilegible, datos incorrectos..."></textarea>
			</div>
			<div class="flex justify-end gap-3 mt-4">
				<Button variant="secondary" onclick={() => isRejectModalOpen = false} disabled={actionLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmReject} loading={actionLoading}>Rechazar</Button>
			</div>
		</div>
	</Modal>

	<!-- Modal de Inscripciones Modularizado -->
	<EnrollmentsModal
		isOpen={isEnrollmentsOpen}
		student={selectedStudent}
		{enrollmentsLoading}
		{studentEnrollments}
		onClose={() => isEnrollmentsOpen = false}
	/>

	<!-- Modal de Importación Modularizado -->
	<ImportModal
		isOpen={isImportModalOpen}
		{importLoading}
		{downloadTemplateCSV}
		onClose={() => isImportModalOpen = false}
		onDownloadTemplate={downloadTemplateCSV}
		onFileChange={(e) => {
			const files = (e.target as HTMLInputElement).files;
			if (files && files.length > 0) importFile = files[0];
		}}
		onSubmit={handleImportExcelSubmit}
		courses={allCourses}
		bind:importFile={importFile}
		bind:importTipoEstudiante={importTipoEstudiante}
		bind:importCursoId={importCursoId}
		bind:importReport={importReport}
	/>

	<!-- Barra de Acciones Flotante -->
	{#if selectedStudentIds.length > 0 && isSuperAdmin}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 dark:bg-gray-950/95 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-6 z-50 border border-gray-800 dark:border-gray-700 backdrop-blur-sm transition-all duration-300">
			<span class="text-sm font-semibold tracking-wider">{selectedStudentIds.length} estudiantes seleccionados</span>
			<div class="flex gap-2">
				<Button variant="secondary" class="text-xs py-1 px-3 bg-gray-800 text-white hover:bg-gray-700 border-0 transition-colors" onclick={() => selectedStudentIds = []}>Deseleccionar</Button>
				<Button variant="destructive" class="text-xs py-1 px-3 font-semibold" onclick={() => showBulkDeleteModal = true}>Eliminar Selección</Button>
			</div>
		</div>
	{/if}

	<ModalConfirm isOpen={showBulkDeleteModal} message={`¿Estás seguro de que deseas eliminar a los estudiantes seleccionados?`} onConfirm={handleBulkDelete} onCancel={() => showBulkDeleteModal = false} loading={bulkDeleteLoading} />
</div>
