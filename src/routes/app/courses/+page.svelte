<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService } from '$lib/services';
	import type { Course } from '$lib/interfaces';
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

	let courses: Course[] = [];
	let loading = false;
	let error = '';
	let skip = 0;
	let limit = 100;

	// Modal state
	let isFormOpen = false;
	let selectedCourse: Course | null = null;
	let showDeleteModal = false;
	let courseToDelete: Course | null = null;
	let deleteLoading = false;

	// Dropdown state
	let openDropdownId: string | null = null;

	onMount(() => {
		loadCourses();
	});

	async function loadCourses() {
		loading = true;
		try {
			courses = await courseService.getAll(skip, limit);
		} catch (e: any) {
			error = e.message || 'Error al cargar cursos';
			alert('error', error);
		} finally {
			loading = false;
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

	{#if loading}
		<TableSkeleton columns={6} rows={5} />
	{:else if courses.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay cursos registrados.</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class="divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Programa</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modalidad</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fechas</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
						<th scope="col" class="relative px-6 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each courses as course}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{course.codigo}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">{course.tipo_curso}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{course.nombre_programa}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white capitalize">{course.modalidad}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-xs text-gray-500 dark:text-gray-400">
									{new Date(course.fecha_inicio).toLocaleDateString()} - {new Date(course.fecha_fin).toLocaleDateString()}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${course.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
									{course.activo ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
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
</div>
