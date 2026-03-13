<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { classroomService } from '$lib/services';
	import type {
		Assignment,
		Classroom,
		ClassroomEnrolledStudent,
		ClassroomMaterial,
		Grade,
		Submission,
		SubmissionStatus
	} from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import MaterialUpload from '$lib/features/classroom/MaterialUpload.svelte';
	import AssignmentForm from '$lib/features/classroom/AssignmentForm.svelte';
	import EnrollStudentForm from '$lib/features/classroom/EnrollStudentForm.svelte';
	import SubmissionForm from '$lib/features/classroom/SubmissionForm.svelte';
	import { alert, formatDate } from '$lib/utils';
	import {
		AcademicCapIcon,
		DocumentAddIcon,
		FileTextIcon,
		ClipboardIcon,
		PlusIcon,
		TrashIcon
	} from '$lib/icons/outline';

	// ─── params & role ─────────────────────────────────────────────────────
	let classroomId = $derived($page.params.id as string);
	let isTeacher = $derived($userStore.loginType !== 'student');

	// ─── tabs ──────────────────────────────────────────────────────────────
	type Tab = 'muro' | 'materiales' | 'tareas' | 'examenes' | 'calificaciones' | 'estudiantes';
	let activeTab = $state<Tab>('muro');

	type SubmissionReviewRow = {
		student: ClassroomEnrolledStudent;
		submission: Submission | null;
		status: SubmissionStatus;
	};

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'muro', label: 'Muro' },
		{ id: 'materiales', label: 'Materiales' },
		{ id: 'tareas', label: 'Tareas' },
		{ id: 'examenes', label: 'Exámenes' },
		{ id: 'calificaciones', label: 'Calificaciones' },
		{ id: 'estudiantes', label: 'Estudiantes' }
	];

	// ─── data ──────────────────────────────────────────────────────────────
	let classroom = $state<Classroom | null>(null);
	let materials = $state<ClassroomMaterial[]>([]);
	let tasks = $state<Assignment[]>([]);
	let exams = $state<Assignment[]>([]);
	let grades = $state<Grade[]>([]);
	let enrolledStudents = $state<ClassroomEnrolledStudent[]>([]);

	// Modal states
	let showMaterialForm = $state(false);
	let showAssignmentForm = $state(false);
	let selectedAssignment = $state<Assignment | null>(null);

	let showDeleteMat = $state(false);
	let matToDelete = $state<ClassroomMaterial | null>(null);
	let showDeleteAsg = $state(false);
	let asgToDelete = $state<Assignment | null>(null);

	let showEnrollStudentForm = $state(false);

	let showSubmissionsModal = $state(false);
	let selectedSubmissionAssignment = $state<Assignment | null>(null);
	let submissionReviewRows = $state<SubmissionReviewRow[]>([]);
	let submissionStats = $state({ total: 0, pending: 0, submitted: 0, graded: 0 });
	let loadingSubmissions = $state(false);

	let showGradeModal = $state(false);
	let gradingAssignment = $state<Assignment | null>(null);
	let gradingStudent = $state<ClassroomEnrolledStudent | null>(null);
	let gradingSubmission = $state<Submission | null>(null);
	let gradeScore = $state('');
	let gradeFeedback = $state('');
	let gradingLoading = $state(false);

	let showSubmitForm = $state(false);
	let submittingAssignment = $state<Assignment | null>(null);
	let mySubmissions = $state<Record<string, Submission>>({});

	let loadingMain = $state(false);
	let loadingTab = $state(false);
	let deleteLoading = $state(false);

	const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

	function isValidObjectId(value: string): boolean {
		return OBJECT_ID_REGEX.test(value);
	}

	function statusLabel(status: SubmissionStatus): string {
		if (status === 'graded') return 'Calificado';
		if (status === 'submitted') return 'Entregado';
		return 'Pendiente';
	}

	function statusClass(status: SubmissionStatus): string {
		if (status === 'graded') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
		if (status === 'submitted') return 'bg-yellow-100 text-yellow-800';
		return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
	}

	onMount(() => {
		if (!isValidObjectId(classroomId)) {
			alert('error', 'ID de clase inválido');
			goBack();
			return;
		}
		loadClassroom();
	});

	async function loadClassroom() {
		if (!isValidObjectId(classroomId)) return;
		loadingMain = true;
		try {
			classroom = await classroomService.getById(classroomId);
		} catch (e: any) {
			alert('error', e.message || 'No se pudo cargar la clase');
		} finally {
			loadingMain = false;
		}
	}

	async function switchTab(tab: Tab) {
		if (!isValidObjectId(classroomId)) return;
		activeTab = tab;
		loadingTab = true;
		try {
			if (tab === 'materiales') {
				materials = await classroomService.getMaterials(classroomId);
			} else if (tab === 'tareas') {
				tasks = await classroomService.getAssignments(classroomId, 'TASK');
			} else if (tab === 'examenes') {
				exams = await classroomService.getAssignments(classroomId, 'EXAM');
			} else if (tab === 'calificaciones') {
				grades = await classroomService.getGrades(classroomId);
			} else if (tab === 'estudiantes') {
				enrolledStudents = await classroomService.getEnrolledStudents(classroomId);
			}
		} catch (e: any) {
			alert('error', e.message || 'Error al cargar datos');
		} finally {
			loadingTab = false;
		}
	}

	// ─── material handlers ────────────────────────────────────────────────
	function onMaterialSuccess(material: ClassroomMaterial) {
		showMaterialForm = false;
		materials = [material, ...materials];
	}

	async function confirmDeleteMaterial(material: ClassroomMaterial) {
		matToDelete = material;
		showDeleteMat = true;
	}

	async function handleDeleteMaterial() {
		if (!matToDelete) return;
		deleteLoading = true;
		try {
			await classroomService.deleteMaterial(classroomId, matToDelete._id);
			materials = materials.filter(item => item._id !== matToDelete!._id);
			alert('success', 'Material eliminado');
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar');
		} finally {
			deleteLoading = false;
			showDeleteMat = false;
			matToDelete = null;
		}
	}

	// ─── assignment handlers ──────────────────────────────────────────────
	function openCreateAssignment() {
		selectedAssignment = null;
		showAssignmentForm = true;
	}

	function openEditAssignment(assignment: Assignment) {
		selectedAssignment = assignment;
		showAssignmentForm = true;
	}

	function onAssignmentSuccess(assignment: Assignment) {
		showAssignmentForm = false;
		if (assignment.type === 'TASK') {
			const index = tasks.findIndex(item => item._id === assignment._id);
			tasks = index >= 0 ? tasks.with(index, assignment) : [assignment, ...tasks];
		} else {
			const index = exams.findIndex(item => item._id === assignment._id);
			exams = index >= 0 ? exams.with(index, assignment) : [assignment, ...exams];
		}
	}

	async function handleDeleteAssignment() {
		if (!asgToDelete) return;
		deleteLoading = true;
		try {
			await classroomService.deleteAssignment(classroomId, asgToDelete._id);
			if (asgToDelete.type === 'TASK') tasks = tasks.filter(item => item._id !== asgToDelete!._id);
			else exams = exams.filter(item => item._id !== asgToDelete!._id);
			alert('success', 'Actividad eliminada');
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar');
		} finally {
			deleteLoading = false;
			showDeleteAsg = false;
			asgToDelete = null;
		}
	}

	// ─── student submission handlers ──────────────────────────────────────
	function openSubmitForm(assignment: Assignment) {
		submittingAssignment = assignment;
		showSubmitForm = true;
	}

	function onSubmissionSuccess(submission: Submission) {
		showSubmitForm = false;
		mySubmissions = { ...mySubmissions, [submission.assignment_id]: submission };
	}

	// ─── teacher review handlers ──────────────────────────────────────────
	function buildSubmissionReviewRows(
		students: ClassroomEnrolledStudent[],
		submissions: Submission[]
	): SubmissionReviewRow[] {
		const submissionByStudent = new Map(submissions.map(submission => [submission.student_id, submission]));
		const enrolledIds = new Set(students.map(student => student._id));

		const rows: SubmissionReviewRow[] = students.map(student => {
			const submission = submissionByStudent.get(student._id) ?? null;
			return {
				student,
				submission,
				status: submission?.status ?? 'pending'
			};
		});

		for (const submission of submissions) {
			if (!enrolledIds.has(submission.student_id)) {
				rows.push({
					student: {
						_id: submission.student_id,
						registro: submission.student_id,
						nombre: submission.student_id,
						email: undefined,
						activo: true
					},
					submission,
					status: submission.status
				});
			}
		}

		return rows;
	}

	function calculateSubmissionStats(rows: SubmissionReviewRow[]) {
		const stats = { total: rows.length, pending: 0, submitted: 0, graded: 0 };
		for (const row of rows) {
			if (row.status === 'graded') stats.graded += 1;
			else if (row.status === 'submitted') stats.submitted += 1;
			else stats.pending += 1;
		}
		return stats;
	}

	async function loadSubmissionsForAssignment(assignment: Assignment) {
		loadingSubmissions = true;
		try {
			const [submissions, students] = await Promise.all([
				classroomService.getSubmissions(classroomId, assignment._id),
				classroomService.getEnrolledStudents(classroomId)
			]);
			const rows = buildSubmissionReviewRows(students, submissions);
			submissionReviewRows = rows;
			submissionStats = calculateSubmissionStats(rows);
		} catch (e: any) {
			alert('error', e.message || 'Error al cargar entregas');
		} finally {
			loadingSubmissions = false;
		}
	}

	async function openSubmissionsModal(assignment: Assignment) {
		selectedSubmissionAssignment = assignment;
		showSubmissionsModal = true;
		await loadSubmissionsForAssignment(assignment);
	}

	function closeSubmissionsModal() {
		showSubmissionsModal = false;
		selectedSubmissionAssignment = null;
		submissionReviewRows = [];
		submissionStats = { total: 0, pending: 0, submitted: 0, graded: 0 };
	}

	function getStudentDisplay(student: ClassroomEnrolledStudent): string {
		return student.nombre || student.registro || student._id;
	}

	function openGradeModal(assignment: Assignment, row: SubmissionReviewRow) {
		if (!row.submission) {
			alert('error', 'Este estudiante aún no tiene entrega para revisar');
			return;
		}
		gradingAssignment = assignment;
		gradingStudent = row.student;
		gradingSubmission = row.submission;
		gradeScore = row.submission.score != null ? String(row.submission.score) : '';
		gradeFeedback = row.submission.feedback ?? '';
		showSubmissionsModal = false;
		showGradeModal = true;
	}

	async function closeGradeModalAndBack() {
		const assignment = gradingAssignment;
		showGradeModal = false;
		gradingAssignment = null;
		gradingStudent = null;
		gradingSubmission = null;
		gradeScore = '';
		gradeFeedback = '';

		if (assignment) {
			selectedSubmissionAssignment = assignment;
			showSubmissionsModal = true;
			await loadSubmissionsForAssignment(assignment);
		}
	}

	async function handleGradeSubmission(e: Event) {
		e.preventDefault();
		if (!gradingAssignment || !gradingSubmission) return;

		const score = Number(gradeScore);
		if (Number.isNaN(score) || score < 0) {
			alert('error', 'La nota debe ser un número válido mayor o igual a 0');
			return;
		}

		if (score > gradingAssignment.max_score) {
			alert('error', `La nota no puede superar ${gradingAssignment.max_score}`);
			return;
		}

		gradingLoading = true;
		try {
			await classroomService.gradeSubmission(
				classroomId,
				gradingAssignment._id,
				gradingSubmission._id,
				{
					score,
					feedback: gradeFeedback.trim() || undefined
				}
			);
			alert('success', 'Entrega calificada correctamente');

			if (activeTab === 'calificaciones') {
				await switchTab('calificaciones');
			}

			await closeGradeModalAndBack();
		} catch (e: any) {
			alert('error', e.message || 'Error al calificar la entrega');
		} finally {
			gradingLoading = false;
		}
	}

	// ─── helpers ──────────────────────────────────────────────────────────
	function goBack() {
		goto(isTeacher ? '/app/classroom/docente' : '/app/classroom/estudiante');
	}

	function handleEnrollSuccess() {
		showEnrollStudentForm = false;
		if (activeTab === 'estudiantes') {
			switchTab('estudiantes');
		}
	}

	function formatBytes(bytes?: number): string {
		if (!bytes) return '';
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<button
				onclick={goBack}
				class="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				title="Volver"
			>
				<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			{#if loadingMain}
				<div class="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
			{:else}
				<Heading level="h1">{classroom?.nombre ?? 'Clase'}</Heading>
			{/if}
		</div>

		{#if isTeacher}
			<Button onclick={() => (showEnrollStudentForm = true)}>
				Inscribir Estudiante
			</Button>
		{/if}
	</div>

	{#if classroom?.descripcion}
		<p class="text-sm text-gray-500 dark:text-gray-400 -mt-2">{classroom.descripcion}</p>
	{/if}

	<div class="border-b border-gray-200 dark:border-gray-700">
		<nav class="-mb-px flex gap-x-6 overflow-x-auto" aria-label="Tabs">
			{#each tabs as tab}
				<button
					onclick={() => switchTab(tab.id)}
					class={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors
						${activeTab === tab.id
							? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}`}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</div>

	<div class="min-h-64">
		{#if loadingTab}
			<TableSkeleton columns={3} rows={3} />

		{:else if activeTab === 'muro'}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
				<AcademicCapIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
				<p class="text-gray-500 dark:text-gray-400 font-medium">Muro de la clase</p>
				<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Los anuncios y novedades aparecerán aquí.</p>
			</div>

		{:else if activeTab === 'materiales'}
			{#if isTeacher}
				<div class="flex justify-end mb-4">
					<Button onclick={() => (showMaterialForm = true)}>
						{#snippet leftIcon()}
							<PlusIcon class="size-5" />
						{/snippet}
						Subir Material
					</Button>
				</div>
			{/if}

			{#if materials.length === 0}
				<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
					<DocumentAddIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p class="text-gray-500 dark:text-gray-400 font-medium">No hay materiales aún.</p>
				</div>
			{:else}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
					{#each materials as material}
						<div class="flex items-center justify-between px-4 py-3">
							<div class="flex items-center gap-3 min-w-0">
								<FileTextIcon class="size-5 text-gray-400 shrink-0" />
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{material.title}</p>
									<p class="text-xs text-gray-400">
										{material.mime_type?.split('/')[1]?.toUpperCase() ?? ''}
										{formatBytes(material.size_bytes)}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2 shrink-0 ml-4">
								<a href={material.file_url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary-600 hover:underline">
									Descargar
								</a>
								{#if isTeacher}
									<button
										onclick={() => confirmDeleteMaterial(material)}
										class="p-1 text-gray-400 hover:text-red-500 transition-colors"
										title="Eliminar"
									>
										<TrashIcon class="size-4" />
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

		{:else if activeTab === 'tareas'}
			{#if isTeacher}
				<div class="flex justify-end mb-4">
					<Button onclick={openCreateAssignment}>
						{#snippet leftIcon()}
							<PlusIcon class="size-5" />
						{/snippet}
						Nueva Tarea
					</Button>
				</div>
			{/if}

			{#if tasks.length === 0}
				<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
					<ClipboardIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p class="text-gray-500 dark:text-gray-400 font-medium">No hay tareas asignadas.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each tasks as task}
						<div class="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-semibold text-gray-900 dark:text-white">{task.title}</p>
									{#if task.description}
										<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{task.description}</p>
									{/if}
									<div class="flex gap-3 mt-1 text-xs text-gray-400">
										{#if task.due_at}<span>Entrega: {formatDate(task.due_at)}</span>{/if}
										<span>Nota máx: {task.max_score}</span>
									</div>
								</div>
								<div class="flex gap-1 shrink-0">
									{#if isTeacher}
										<button onclick={() => openSubmissionsModal(task)} class="px-2 py-1 text-xs text-primary-600 hover:underline" title="Ver entregas">
											Entregas
										</button>
										<button onclick={() => openEditAssignment(task)} class="p-1 text-gray-400 hover:text-primary-600" title="Editar">
											<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
										<button onclick={() => { asgToDelete = task; showDeleteAsg = true; }} class="p-1 text-gray-400 hover:text-red-500" title="Eliminar">
											<TrashIcon class="size-4" />
										</button>
									{:else}
										{@const mine = mySubmissions[task._id]}
										<Button variant={mine ? 'secondary' : 'primary'} onclick={() => openSubmitForm(task)}>
											{mine ? 'Ver Entrega' : 'Entregar'}
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		{:else if activeTab === 'examenes'}
			{#if isTeacher}
				<div class="flex justify-end mb-4">
					<Button onclick={openCreateAssignment}>
						{#snippet leftIcon()}
							<PlusIcon class="size-5" />
						{/snippet}
						Nuevo Examen
					</Button>
				</div>
			{/if}

			{#if exams.length === 0}
				<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
					<ClipboardIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p class="text-gray-500 dark:text-gray-400 font-medium">No hay exámenes programados.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each exams as exam}
						<div class="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-semibold text-gray-900 dark:text-white">{exam.title}</p>
									{#if exam.description}
										<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{exam.description}</p>
									{/if}
									<div class="flex gap-3 mt-1 text-xs text-gray-400">
										{#if exam.due_at}<span>Fecha: {formatDate(exam.due_at)}</span>{/if}
										<span>Nota máx: {exam.max_score}</span>
									</div>
								</div>
								<div class="flex gap-1 shrink-0">
									{#if isTeacher}
										<button onclick={() => openSubmissionsModal(exam)} class="px-2 py-1 text-xs text-primary-600 hover:underline" title="Ver entregas">
											Entregas
										</button>
										<button onclick={() => openEditAssignment(exam)} class="p-1 text-gray-400 hover:text-primary-600" title="Editar">
											<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
										<button onclick={() => { asgToDelete = exam; showDeleteAsg = true; }} class="p-1 text-gray-400 hover:text-red-500" title="Eliminar">
											<TrashIcon class="size-4" />
										</button>
									{:else}
										{@const mine = mySubmissions[exam._id]}
										<Button variant={mine ? 'secondary' : 'primary'} onclick={() => openSubmitForm(exam)}>
											{mine ? 'Ver Entrega' : 'Entregar'}
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		{:else if activeTab === 'calificaciones'}
			{#if grades.length === 0}
				<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
					<AcademicCapIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p class="text-gray-500 dark:text-gray-400 font-medium">No hay calificaciones registradas.</p>
				</div>
			{:else}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-900">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each grades as grade}
								<tr>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white">
										<p class="font-medium">{grade.assignment_title}</p>
										{#if grade.feedback}
											<p class="text-xs text-gray-400 mt-0.5 italic">{grade.feedback}</p>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class={`text-xs font-medium px-2 py-0.5 rounded-full ${grade.assignment_type === 'EXAM' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
											{grade.assignment_type === 'EXAM' ? 'Examen' : 'Tarea'}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusClass(grade.status)}`}>
											{statusLabel(grade.status)}
										</span>
									</td>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
										{grade.score != null ? `${grade.score} / ${grade.max_score}` : '—'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

		{:else if activeTab === 'estudiantes'}
			{#if enrolledStudents.length === 0}
				<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
					<AcademicCapIcon class="mx-auto size-10 text-gray-300 dark:text-gray-600 mb-3" />
					<p class="text-gray-500 dark:text-gray-400 font-medium">No hay estudiantes inscritos.</p>
				</div>
			{:else}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-900">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each enrolledStudents as student}
								<tr>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{student.nombre || 'Sin nombre'}</td>
									<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{student.registro}</td>
									<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{student.email || '—'}</td>
									<td class="px-4 py-3">
										<span class={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${student.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
											{student.activo ? 'Activo' : 'Inactivo'}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Modals -->
<Modal isOpen={showMaterialForm} title="Subir Material" onClose={() => (showMaterialForm = false)} maxWidth="sm:max-w-lg">
	<MaterialUpload {classroomId} onSuccess={onMaterialSuccess} onCancel={() => (showMaterialForm = false)} />
</Modal>

<Modal
	isOpen={showAssignmentForm}
	title={selectedAssignment ? 'Editar Actividad' : activeTab === 'examenes' ? 'Nuevo Examen' : 'Nueva Tarea'}
	onClose={() => (showAssignmentForm = false)}
	maxWidth="sm:max-w-lg"
>
	<AssignmentForm
		{classroomId}
		assignment={selectedAssignment}
		onSuccess={onAssignmentSuccess}
		onCancel={() => (showAssignmentForm = false)}
	/>
</Modal>

<Modal
	isOpen={showEnrollStudentForm}
	title="Inscribir Estudiante"
	onClose={() => (showEnrollStudentForm = false)}
	maxWidth="sm:max-w-2xl"
>
	<EnrollStudentForm
		{classroomId}
		onSuccess={handleEnrollSuccess}
		onCancel={() => (showEnrollStudentForm = false)}
	/>
</Modal>

<Modal
	isOpen={showSubmissionsModal}
	title={`Entregas: ${selectedSubmissionAssignment?.title ?? ''}`}
	onClose={closeSubmissionsModal}
	maxWidth="sm:max-w-4xl"
>
	{#if loadingSubmissions}
		<TableSkeleton columns={6} rows={4} />
	{:else if submissionReviewRows.length === 0}
		<div class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
			No hay estudiantes inscritos en esta clase.
		</div>
	{:else}
		<div class="mb-3 flex flex-wrap gap-2">
			<span class="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
				Total: {submissionStats.total}
			</span>
			<span class="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800">
				Pendientes: {submissionStats.pending}
			</span>
			<span class="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
				Entregados: {submissionStats.submitted}
			</span>
			<span class="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
				Calificados: {submissionStats.graded}
			</span>
		</div>

		<div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrega</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each submissionReviewRows as row}
						<tr>
							<td class="px-4 py-3 text-sm text-gray-900 dark:text-white">
								<p class="font-medium">{getStudentDisplay(row.student)}</p>
								<p class="text-xs text-gray-400">{row.student.registro}</p>
								{#if row.student.email}
									<p class="text-xs text-gray-400 truncate max-w-64">{row.student.email}</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
								{#if row.submission}
									{#if row.submission.text_content}
										<p class="text-xs text-gray-500 dark:text-gray-400">Texto enviado ({row.submission.text_content.length} caracteres)</p>
									{/if}
									{#if row.submission.file_url}
										<a href={row.submission.file_url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary-600 hover:underline">Abrir archivo adjunto</a>
										<p class="text-xs text-gray-400">{row.submission.mime_type?.split('/')[1]?.toUpperCase() ?? 'ARCHIVO'} {formatBytes(row.submission.size_bytes)}</p>
									{:else}
										<p class="text-xs text-gray-400">Sin archivo adjunto</p>
									{/if}
									<p class="text-xs text-gray-400">Enviado: {row.submission.submitted_at ? formatDate(row.submission.submitted_at) : '—'}</p>
								{:else}
									<p class="text-xs text-gray-400">Sin entrega registrada</p>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusClass(row.status)}`}>
									{statusLabel(row.status)}
								</span>
							</td>
							<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
								{row.submission?.score != null ? row.submission.score : '—'}
							</td>
							<td class="px-4 py-3 text-right">
								{#if selectedSubmissionAssignment && row.submission}
									<Button type="button" variant="secondary" onclick={() => openGradeModal(selectedSubmissionAssignment!, row)}>
										{row.status === 'graded' ? 'Revisar' : 'Calificar'}
									</Button>
								{:else}
									<Button type="button" variant="secondary" disabled>
										Sin entrega
									</Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="flex justify-end pt-4">
		<Button variant="secondary" type="button" onclick={closeSubmissionsModal}>Cerrar</Button>
	</div>
</Modal>

<Modal isOpen={showGradeModal} title="Calificar Entrega" onClose={closeGradeModalAndBack} maxWidth="sm:max-w-lg">
	{#if gradingAssignment && gradingSubmission}
		<form onsubmit={handleGradeSubmission} class="space-y-4">
			<div class="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
				<p class="text-xs text-gray-500 dark:text-gray-400">Estudiante</p>
				<p class="text-sm font-medium text-gray-900 dark:text-white">{gradingStudent ? getStudentDisplay(gradingStudent) : gradingSubmission.student_id}</p>
				{#if gradingStudent?.registro}
					<p class="text-xs text-gray-400">Registro: {gradingStudent.registro}</p>
				{/if}
				<p class="text-xs text-gray-400">Actividad: {gradingAssignment.title}</p>
			</div>

			<div class="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2">
				<p class="text-xs text-gray-500 dark:text-gray-400">Entrega del estudiante</p>
				<p class="text-xs text-gray-400">Fecha de entrega: {gradingSubmission.submitted_at ? formatDate(gradingSubmission.submitted_at) : '—'}</p>

				<div>
					<p class="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Respuesta textual</p>
					{#if gradingSubmission.text_content}
						<div class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded p-2 max-h-40 overflow-y-auto">
							{gradingSubmission.text_content}
						</div>
					{:else}
						<p class="text-xs text-gray-400">No envió texto.</p>
					{/if}
				</div>

				<div>
					<p class="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Archivo adjunto</p>
					{#if gradingSubmission.file_url}
						<a href={gradingSubmission.file_url} target="_blank" rel="noopener noreferrer" class="text-sm text-primary-600 hover:underline">
							Abrir archivo adjunto
						</a>
						<p class="text-xs text-gray-400">{gradingSubmission.mime_type?.split('/')[1]?.toUpperCase() ?? 'ARCHIVO'} {formatBytes(gradingSubmission.size_bytes)}</p>
					{:else}
						<p class="text-xs text-gray-400">No adjuntó archivo.</p>
					{/if}
				</div>
			</div>

			<div>
				<label for="grade-score" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Nota (máx. {gradingAssignment.max_score})
				</label>
				<input
					id="grade-score"
					type="number"
					min="0"
					max={gradingAssignment.max_score}
					step="0.1"
					required
					bind:value={gradeScore}
					class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				/>
			</div>

			<div>
				<label for="grade-feedback" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Feedback (opcional)
				</label>
				<textarea
					id="grade-feedback"
					rows="4"
					maxlength="2000"
					bind:value={gradeFeedback}
					class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				></textarea>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" type="button" onclick={closeGradeModalAndBack} disabled={gradingLoading}>
					Cancelar
				</Button>
				<Button type="submit" loading={gradingLoading}>Guardar Nota</Button>
			</div>
		</form>
	{/if}
</Modal>

{#if submittingAssignment}
	<Modal
		isOpen={showSubmitForm}
		title={`Entregar: ${submittingAssignment.title}`}
		onClose={() => (showSubmitForm = false)}
		maxWidth="sm:max-w-lg"
	>
		<SubmissionForm
			assignment={submittingAssignment}
			existing={mySubmissions[submittingAssignment._id] ?? null}
			onSuccess={onSubmissionSuccess}
			onCancel={() => (showSubmitForm = false)}
		/>
	</Modal>
{/if}

<ModalConfirm
	isOpen={showDeleteMat}
	message={`¿Eliminar el material "${matToDelete?.title}"? Se borrará también de Cloudinary.`}
	onConfirm={handleDeleteMaterial}
	onCancel={() => {
		showDeleteMat = false;
		matToDelete = null;
	}}
	loading={deleteLoading}
/>

<ModalConfirm
	isOpen={showDeleteAsg}
	message={`¿Eliminar la actividad "${asgToDelete?.title}"?`}
	onConfirm={handleDeleteAssignment}
	onCancel={() => {
		showDeleteAsg = false;
		asgToDelete = null;
	}}
	loading={deleteLoading}
/>
