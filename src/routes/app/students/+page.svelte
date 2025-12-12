<script lang="ts">
	import { onMount } from 'svelte';
	import { studentService, enrollmentService } from '$lib/services';
	import type { Student, Enrollment } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import StudentDetails from '$lib/features/students/StudentDetails.svelte';
	import StudentForm from '$lib/features/students/StudentForm.svelte';
	import { PlusIcon, DotsVerticalIcon, UserIcon, CheckIcon, XIcon, FileTextIcon } from '$lib/icons/outline';
	import { alert } from '$lib/utils';
	import Input from '$lib/components/ui/input.svelte';

	let students: Student[] = [];
	let loading = true;
	let page = 0;
	let limit = 100;

	// Modal State
	let isFormOpen = false;
	let isDetailsOpen = false;
	let selectedStudent: Student | null = null;
	let isDeleteModalOpen = false;
	let studentToDelete: Student | null = null;
	let deleteLoading = false;
	
	// Verify/Reject State
	let isVerifyModalOpen = false;
	let isRejectModalOpen = false;
	let studentToAction: Student | null = null;
	let actionLoading = false;
	let rejectReason = '';

	// Dropdown state
	let openDropdownId: string | null = null;

	// Enrollments Modal State
	let isEnrollmentsOpen = false;
	let studentEnrollments: Enrollment[] = [];
	let enrollmentsLoading = false;

	async function loadStudents() {
		loading = true;
		try {
			const data = await studentService.getAll(page * limit, limit);
			console.log("students", data);
			students = data;
		} catch (error) {
			console.error(error);
			alert('error', 'Error al cargar estudiantes');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
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
		try {
			await studentService.delete(studentToDelete._id);
			alert('success', 'Estudiante eliminado correctamente');
			isDeleteModalOpen = false;
			loadStudents();
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
		try {
			// We verify with empty data assuming current data is correct for this quick action
			await studentService.verifyTitulo(studentToAction._id, {});
			alert('success', 'Título verificado correctamente');
			isVerifyModalOpen = false;
			loadStudents();
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
		try {
			await studentService.rejectTitulo(studentToAction._id, rejectReason);
			alert('success', 'Título rechazado correctamente');
			isRejectModalOpen = false;
			loadStudents();
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
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<Heading level="h1">Estudiantes</Heading>
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nuevo Estudiante
		</Button>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={5} />
	{:else}
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-800">
					<tr>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domicilio</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
						<th scope="col" class="relative px-6 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
					{#each students as student}
						<tr>
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
								<div class="text-sm text-gray-500">{student.es_estudiante_interno}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.celular}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{student.domicilio}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
									{student.activo ? 'Activo' : 'Inactivo'}
								</span>
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

	<!-- Delete Confirmation Modal -->
	<ModalConfirm
		isOpen={isDeleteModalOpen}
		message={`¿Estás seguro de que deseas eliminar al estudiante ${studentToDelete?.nombre}? Esta acción no se puede deshacer.`}
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
							{#each studentEnrollments as enrollment}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{new Date(enrollment.fecha_inscripcion).toLocaleDateString()}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="text-xs text-gray-500">Total: {enrollment.total_a_pagar}</div>
										<div class="text-xs text-green-600">Pagado: {enrollment.total_pagado}</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
											{enrollment.saldo_pendiente}
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
</div>
