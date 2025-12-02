<script lang="ts">
	import { onMount } from 'svelte';
	import { studentService } from '$lib/services';
	import type { Student } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import StudentForm from '$lib/features/students/StudentForm.svelte';
	import { PlusIcon, DotsVerticalIcon, UserIcon } from '$lib/icons/outline';
	import { alert } from '$lib/utils';

	let students: Student[] = [];
	let loading = true;
	let page = 0;
	let limit = 100;

	// Modal State
	let isFormOpen = false;
	let selectedStudent: Student | null = null;
	let isDeleteModalOpen = false;
	let studentToDelete: Student | null = null;
	let deleteLoading = false;

	// Dropdown state
	let openDropdownId: string | null = null;

	async function loadStudents() {
		loading = true;
		try {
			const data = await studentService.getAll(page * limit, limit);
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

	function handleFormSuccess() {
		isFormOpen = false;
		loadStudents();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(student: Student) {
		return [
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
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carrera</th>
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
									<div class="text-sm text-gray-900 dark:text-white">{student.carrera}</div>
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
	>
		<StudentForm
			student={selectedStudent}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<!-- Delete Confirmation Modal -->
	<ModalConfirm
		isOpen={isDeleteModalOpen}
		message={`¿Estás seguro de que deseas eliminar al estudiante ${studentToDelete?.nombre}? Esta acción no se puede deshacer.`}
		onConfirm={confirmDelete}
		onCancel={() => isDeleteModalOpen = false}
		loading={deleteLoading}
	/>
</div>
