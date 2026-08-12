<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService } from '$lib/services';
	import type { Course, CourseStudent } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore'; // <-- Importación del Store
	import { STAFF_EC_COURSES } from '$lib/auth/roles'; // F-2026-08-11-EC-AUTOSERVICIO
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import ComunicadoModal from '$lib/features/courses/ComunicadoModal.svelte';
	import CargaInicialModal from '$lib/features/courses/CargaInicialModal.svelte';
	import AgregarEstudianteModal from '$lib/features/courses/AgregarEstudianteModal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import CourseForm from '$lib/features/courses/CourseForm.svelte';
	import CourseWizard from '$lib/features/courses/CourseWizard.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import { exportToExcel } from '$lib/utils/excelExport';
	import SearchInput from '$lib/components/ui/searchInput.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon, DownloadIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';
	import { formatCurrency, formatDate } from '$lib/utils';

	let courses: Course[] = $state([]);
	let loading = $state(false);
	let error = $state('');
	
	// Pagination state
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Filter state
	let filters = $state({
		q: '',
		activo: 'all', // 'all', 'true', 'false'
		tipo_curso: 'all',
		modalidad: 'all'
	});
	let debounceTimer: any;

	// Modal state
	let isFormOpen = $state(false);
	let isWizardOpen = $state(false); // F-HISTORICO-AUTOSERVICIO: wizard nuevo
	let selectedCourse: Course | null = $state(null);
	let showDeleteModal = $state(false);
	let courseToDelete: Course | null = $state(null);
	let deleteLoading = $state(false);

	// F-HISTORICO (2026-07-31): modal dedicado para subir la resolución de
	// respaldo desde el menú desplegable del catálogo (sin abrir el editor
	// completo). Útil para programas ya creados a los que se les quiere
	// añadir la resolución más tarde.
	let showResolucionModal = $state(false);
	let resolucionCourse: Course | null = $state(null);
	let resolucionFile: File | null = $state(null);
	let subiendoResolucion = $state(false);
	function openResolucionModal(course: Course) {
		resolucionCourse = course;
		resolucionFile = null;
		showResolucionModal = true;
		openDropdownId = null;
	}
	async function handleSubirResolucion() {
		if (!resolucionCourse || !resolucionFile) return;
		subiendoResolucion = true;
		try {
			const updated = await courseService.subirResolucion(resolucionCourse._id, resolucionFile);
			alert('success', `Resolución de respaldo subida al programa "${updated.nombre_programa}"`);
			// Reflejar el cambio en la lista local
			courses = courses.map((c) => (c._id === updated._id ? { ...c, resolucion_pdf_url: updated.resolucion_pdf_url } : c));
			showResolucionModal = false;
			resolucionFile = null;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo subir la resolución de respaldo');
		} finally {
			subiendoResolucion = false;
		}
	}

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	// Students Modal state
	let showStudentsModal = $state(false);
	let studentsLoading = $state(false);
	let courseStudents: CourseStudent[] = $state([]);
	let selectedCourseStudents: Course | null = $state(null);

	// ISSUE N: Control de Permisos Visuales
	let currentRole = $derived(($userStore.role || '').toLowerCase());
	// F-2026-08-11-EC-AUTOSERVICIO: encargado_curso/coord pueden intentar
	// crear programas. El backend rechaza con 403 si NO son historicos.
	let canCreateCourse = $derived(STAFF_EC_COURSES.includes(currentRole));
	let canEditCourse = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canDeleteCourse = $derived(currentRole === 'superadmin');
	// Comunicados: Encargado de Programa / Coordinador / CPD / Admin / Superadmin.
	// (El Encargado solo a sus programas: lo valida el backend con 403.)
	let canSendComunicado = $derived(
		['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'].includes(currentRole)
	);
	// F-2026-08-12-EC-CARGA-INICIAL-VISIBILITY (Kevin 2026-08-12 post-reunion):
	// el EC/COORDINADOR DEBE poder cargar estudiantes en programas historicos
	// y en ejecucion de SUS cursos asignados. Antes la opcion del menu solo
	// aparecia para CPD/ADMIN/SUPERADMIN (canEditCourse), lo que dejaba al EC
	// sin la opcion "Carga Inicial de Estudiantes" en el menu de 3 puntos.
	// El backend ya valida que el curso sea de los cursos_asignados del EC
	// (enrollment.py valida curso_id in current_user.cursos_asignados para
	// encargado_curso y coordinador). Por eso el frontend puede mostrar la
	// opcion a EC/COORDINADOR sin riesgo: si intenta algo fuera de su
	// scope, el backend rechaza con 403.
	let canCargaInicial = $derived(
		['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'].includes(currentRole)
	);
	let comunicadoOpen = $state(false);
	let comunicadoCourseId = $state('');
	let comunicadoPrograma = $state('');
	function openComunicado(course: Course) {
		comunicadoCourseId = course._id;
		comunicadoPrograma = course.nombre_programa;
		comunicadoOpen = true;
		openDropdownId = null;
	}

	// F-US-006-3TIPOS-3A-FE (2026-08-04): modal de carga inicial de
	// estudiantes para programas en_ejecucion o historicos.
	let cargaInicialOpen = $state(false);
	let cargaInicialCourse: Course | null = $state(null);
	function openCargaInicial(course: Course) {
		cargaInicialCourse = course;
		cargaInicialOpen = true;
		openDropdownId = null;
	}

	// F-US-006-3TIPOS-3B (2026-08-04): modal para agregar 1 estudiante a
	// un programa en_ejecucion (lo incorpora a un modulo futuro). Caso:
	// el estudiante llega tarde y el admin/encargado lo mete manualmente.
	let agregarEstudianteOpen = $state(false);
	let agregarEstudianteCourse: Course | null = $state(null);
	function openAgregarEstudiante(course: Course) {
		agregarEstudianteCourse = course;
		agregarEstudianteOpen = true;
		openDropdownId = null;
	}

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
				// F-COURSES-FILTER-ENCARGADO (2026-08-09, Kevin): encargado_curso
				// con cursos_asignados solo ve los cursos que tiene asignados.
				// Antes el backend no filtraba y el frontend mostraba todos los
				// programas del sistema, exponiendo informacion de programas que
				// el usuario no deberia ver.
				const cursosAsignados = ($userStore.user?.cursos_asignados ?? []) as string[];
				if (currentRole === 'encargado_curso' && cursosAsignados.length > 0) {
					const assignedSet = new Set(cursosAsignados.map(String));
					courses = response.data.filter((c: Course) => assignedSet.has(String(c._id)));
				} else {
					courses = response.data;
				}
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

	function clearCourseFilters() {
		filters = { q: '', activo: 'all', tipo_curso: 'all', modalidad: 'all' };
		page = 1;
		loadCourses();
	}

	let hasActiveCourseFilters = $derived(
		!!(filters.q || filters.activo !== 'all' || filters.tipo_curso !== 'all' || filters.modalidad !== 'all')
	);

	function handleCreate() {
		// F-HISTORICO-AUTOSERVICIO (2026-08-04): ahora abre el wizard de 3 tipos
		// en vez del CourseForm monolítico. El usuario elige el tipo primero.
		isWizardOpen = true;
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
		
		const idToDelete = courseToDelete._id;
		
		try {
			await courseService.delete(idToDelete);
			alert('success', 'Programa eliminado correctamente');
			courses = courses.filter(c => c._id !== idToDelete);
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
		// Opción base: Todos los del Staff pueden ver la lista de alumnos
		const options: any[] = [
			{
				label: 'Ver Estudiantes',
				id: 'students',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
				action: () => handleViewStudents(course)
			}
		];

		// Inyección de opciones según rol
		if (canEditCourse) {
			options.push({
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(course)
			});
		}

		// F-HISTORICO (2026-07-31): opción para subir la resolución de respaldo
		// del programa. Disponible para todos los programas (nuevos, en ejecución,
		// históricos). El ícono es el mismo de un upload de documento.
		if (canEditCourse) {
			options.push({
				label: (course as any).resolucion_pdf_url
					? 'Reemplazar Resolución'
					: 'Subir Resolución',
				id: 'resolucion',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
				action: () => openResolucionModal(course)
			});
		}

		if (canSendComunicado) {
			options.push({
				label: 'Enviar Comunicado',
				id: 'comunicado',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
				action: () => openComunicado(course)
			});
		}

		// F-US-006-3TIPOS-3A-FE: opcion para carga inicial de estudiantes.
		// Solo aparece si el curso esta en_ejecucion o historico (los
		// programados usan el flujo normal de inscripcion). El admin o
		// encargado carga los carnets de los estudiantes que ya estaban
		// en el programa.
		// F-2026-08-12-EC-CARGA-INICIAL-VISIBILITY: ahora la opcion tambien
		// aparece para EC/COORDINADOR (canCargaInicial). Antes solo aparecia
		// para CPD/ADMIN/SUPERADMIN (canEditCourse), lo que dejaba al EC
		// sin acceso a la opcion aunque el backend lo permitiera.
		const estadoCalc = (course as any).estado_calculado || (course as any).estado;
		if (canCargaInicial && (estadoCalc === 'en_ejecucion' || estadoCalc === 'cerrado' || (course as any).es_historico)) {
			options.push({
				label: 'Carga Inicial de Estudiantes',
				id: 'carga-inicial',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>`,
				action: () => openCargaInicial(course)
			});
		}

		// F-US-006-3TIPOS-3B: agregar 1 estudiante a un modulo futuro del
		// programa en_ejecucion. Caso: el estudiante llega tarde y el
		// admin/encargado lo mete manualmente a un modulo donde todavia
		// alcanza a cursar. Solo aplica a programas en_ejecucion.
		if (canEditCourse && estadoCalc === 'en_ejecucion') {
			options.push({
				label: 'Agregar Estudiante',
				id: 'agregar-estudiante',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>`,
				action: () => openAgregarEstudiante(course)
			});
		}

		if (canDeleteCourse) {
			options.push({
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(course),
				divider: true
			});
		}

		return options;
	}

	// Export students list per course to CSV
    function exportCourseStudentsToCSV() {
        if (!courseStudents || courseStudents.length === 0) {
            alert('error', 'No hay estudiantes inscritos para exportar.');
            return;
        }

        // F-XXX (2026-07-29): XLSX en vez de CSV.
        const columnDefs = [
            { header: 'Estudiante', key: 'nombre', width: 30 },
            { header: 'CI', key: 'carnet', width: 14 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Celular', key: 'celular', width: 14 },
            { header: 'Estado', key: 'estado', width: 14 },
            { header: 'Fecha Inscripcion', key: 'fecha_inscripcion', width: 16 },
            { header: 'Total', key: 'total_a_pagar', width: 12, format: 'currency' as const },
            { header: 'Pagado', key: 'total_pagado', width: 12, format: 'currency' as const },
            { header: 'Saldo', key: 'saldo_pendiente', width: 12, format: 'currency' as const },
        ];
        try {
            const rows = courseStudents.map((s: any) => ({
                nombre: s.nombre,
                carnet: s.carnet,
                email: s.contacto?.email,
                celular: s.contacto?.celular,
                estado: s.inscripcion?.estado,
                fecha_inscripcion: formatDate(s.inscripcion?.fecha_inscripcion),
                total_a_pagar: s.financiero?.total_a_pagar,
                total_pagado: s.financiero?.total_pagado,
                saldo_pendiente: s.financiero?.saldo_pendiente,
            }));
            const courseNameClean = (selectedCourseStudents?.nombre_programa || 'curso').replace(/\s+/g, '_');
            exportToExcel(rows, columnDefs, `Inscritos_${courseNameClean}`);
            
        } catch (error) {
            console.error("Error al exportar:", error);
            alert('error', 'Ocurrió un error al generar el archivo CSV');
        }
    }

</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Programas</Heading>
		
		<!-- ISSUE N: Ocultar botón Nuevo Programa si no tiene permisos -->
		{#if canCreateCourse}
			<div class="flex flex-col items-end gap-1">
				<Button onclick={handleCreate}>
					{#snippet leftIcon()}
						<PlusIcon class="size-5" />
					{/snippet}
					Nuevo Programa
				</Button>
				<!-- F-2026-08-11-EC-AUTOSERVICIO: aviso para encargado/coordinador -->
				{#if ['encargado_curso', 'coordinador'].includes(currentRole)}
					<p class="text-[10px] text-amber-700 dark:text-amber-400 max-w-xs text-right">
						Como encargado de EC, solo puedes crear programas <strong>históricos</strong>
						(fecha_fin ya pasó). Para programas nuevos consulta con CPD.
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Filters -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
		<!-- Search -->
		<div class="md:col-span-1">
			<label for="search" class="sr-only">Buscar</label>
			<SearchInput
				bind:value={filters.q}
				placeholder="Buscar código o nombre..."
				onInput={() => handleSearchInput()}
			/>
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
				<option value="maestría">Maestría</option>
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
		<EmptyState
			icon="course"
			title={hasActiveCourseFilters ? 'No hay programas con esos filtros' : 'No hay programas registrados'}
			description={hasActiveCourseFilters
				? 'Probá limpiar los filtros para ver todos los programas disponibles.'
				: 'Cuando CPD o Admin cree un nuevo programa de Diplomado, Maestría, Curso o Taller, aparecerá aquí.'}
			ctaLabel={hasActiveCourseFilters
				? 'Limpiar filtros'
				: canCreateCourse ? 'Crear primer programa' : undefined}
			onCta={hasActiveCourseFilters
				? clearCourseFilters
				: canCreateCourse ? handleCreate : undefined}
		/>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código/Prog.</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalles</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo Programa</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cargo Adicional</th>
						<th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Financiero</th>
						
						<th scope="col" class="relative px-3 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each courses as course (course._id)}
						<tr>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
									<span>{course.codigo}</span>
									{#if (course as any).es_historico}
										<span class="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200" title="F-HISTORICO: programa pasado o de registro retroactivo">
											Histórico
										</span>
									{/if}
								</div>
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
								{#if course.cargo_adicional_items && course.cargo_adicional_items.length > 0}
									{#each course.cargo_adicional_items as item}
										<div class="text-xs text-gray-900 dark:text-white">
											{formatCurrency(item.costo)}
											<span class="text-gray-500 dark:text-gray-400 max-w-[140px] truncate" title={item.nombre}>({item.nombre})</span>
										</div>
									{/each}
								{:else}
									<span class="text-xs text-gray-400 dark:text-gray-500">Sin cargo</span>
								{/if}
							</td>
							<td class="px-3 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-900 dark:text-white">Cuotas: {course.cantidad_cuotas}</div>
								<div class="text-xs text-green-600 dark:text-green-400">Desc: {course.descuento_curso}%</div>
							</td>
							
							<td class="px-3 py-4 whitespace-nowrap text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(course._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del programa {course.nombre_programa}">
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
			{#each courses as course (course._id)}
				<Card>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
								<span>{course.nombre_programa}</span>
								{#if (course as any).es_historico}
									<span class="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200" title="F-HISTORICO: programa pasado o de registro retroactivo">
										Histórico
									</span>
								{/if}
							</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">{course.codigo}</p>
						</div>
						<div class="relative">
							<button onclick={() => toggleDropdown(course._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del programa {course.nombre_programa}">
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

	<!-- Create/Edit Modal (legacy: usado para editar) -->
	<Modal
		isOpen={isFormOpen}
		title={selectedCourse ? 'Editar Programa' : 'Nuevo Programa'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<CourseForm
			course={selectedCourse}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<!-- F-HISTORICO-AUTOSERVICIO (2026-08-04): wizard de creación con 3 tipos -->
	<CourseWizard
		isOpen={isWizardOpen}
		onClose={() => isWizardOpen = false}
		onSuccess={handleFormSuccess}
	/>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar el programa ${courseToDelete?.nombre_programa || ''}? Esta acción no se puede deshacer.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			courseToDelete = null;
		}}
		loading={deleteLoading}
	/>

	<!-- Comunicado por programa (Encargado/Coordinador/CPD/Admin/Superadmin) -->
	<ComunicadoModal
		isOpen={comunicadoOpen}
		courseId={comunicadoCourseId}
		programa={comunicadoPrograma}
		onClose={() => (comunicadoOpen = false)}
	/>

	<!-- F-US-006-3TIPOS-3A-FE: carga inicial de estudiantes para
	     programas en_ejecucion o historicos -->
	<CargaInicialModal
		isOpen={cargaInicialOpen}
		course={cargaInicialCourse}
		onClose={() => (cargaInicialOpen = false)}
		onSuccess={() => loadCourses()}
	/>

	<!-- F-US-006-3TIPOS-3B: agregar 1 estudiante a un modulo futuro -->
	<AgregarEstudianteModal
		isOpen={agregarEstudianteOpen}
		course={agregarEstudianteCourse}
		onClose={() => (agregarEstudianteOpen = false)}
		onSuccess={() => loadCourses()}
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
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Total: <span class="font-bold text-gray-900 dark:text-white">{courseStudents.length} inscritos</span>
                </p>
                <Button variant="secondary" onclick={exportCourseStudentsToCSV} class="flex items-center gap-2 text-sm">
					{#snippet leftIcon()}
						<DownloadIcon class="size-4" />
					{/snippet}
					Descargar Excel
                </Button>
            </div>
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
											<span class="text-lg font-medium text-primary-600 dark:text-primary-400">
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
										${student.inscripcion.estado === 'pendiente_pago' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
										  student.inscripcion.estado === 'pagado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
										{student.inscripcion.estado}
									</span>
									<div class="text-xs text-gray-400 mt-0.5">{formatDate(student.inscripcion.fecha_inscripcion)}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900 dark:text-white">Total: {formatCurrency(student.financiero.total_a_pagar)}</div>
									<div class="text-xs text-green-600 dark:text-green-400">Pagado: {formatCurrency(student.financiero.total_pagado)}</div>
									<div class="text-xs text-red-500 dark:text-red-400">Saldo: {formatCurrency(student.financiero.saldo_pendiente)}</div>
									<div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-dark-border">
										<div class="bg-primary-600 h-1.5 rounded-full" style={`width: ${Math.min(student.financiero.avance_pago, 100)}%`}></div>
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

	<!-- F-HISTORICO (2026-07-31): modal dedicado para subir la resolución de
	     respaldo desde el menú desplegable del catálogo (sin abrir el editor
	     completo). Funciona para programas nuevos, en ejecución o históricos. -->
	<Modal
		isOpen={showResolucionModal}
		title="Subir Resolución de Respaldo"
		onClose={() => { showResolucionModal = false; resolucionFile = null; }}
		maxWidth="sm:max-w-lg"
	>
		<div class="space-y-4">
			{#if resolucionCourse}
				<div class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
					<div class="text-sm text-gray-600 dark:text-gray-300">Programa:</div>
					<div class="font-semibold text-gray-900 dark:text-white">{resolucionCourse.nombre_programa}</div>
					<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Código: {resolucionCourse.codigo}
						{#if (resolucionCourse as any).es_historico}
							<span class="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
								Histórico
							</span>
						{/if}
					</div>
				</div>
			{/if}

			{#if resolucionCourse && (resolucionCourse as any).resolucion_pdf_url}
				<div class="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
					<strong>Resolución actual:</strong>
					<a href={(resolucionCourse as any).resolucion_pdf_url} target="_blank" rel="noopener" class="underline break-all ml-1">
						Ver PDF
					</a>
					<div class="text-xs mt-1">Si subís un nuevo PDF, este será reemplazado.</div>
				</div>
			{/if}

			<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Seleccionar PDF
			</label>
			<input
				type="file"
				accept="application/pdf"
				class="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
				onchange={(e) => {
					const target = e.target as HTMLInputElement;
					resolucionFile = target.files?.[0] || null;
				}}
			/>
			{#if resolucionFile}
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Seleccionado: <strong>{resolucionFile.name}</strong> ({Math.round(resolucionFile.size / 1024)} KB)
				</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" onclick={() => { showResolucionModal = false; resolucionFile = null; }}>
					Cancelar
				</Button>
				<Button onclick={handleSubirResolucion} loading={subiendoResolucion} disabled={!resolucionFile}>
					Subir Resolución
				</Button>
			</div>
		</div>
	</Modal>
</div>
