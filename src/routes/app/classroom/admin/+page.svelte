<script lang="ts">
	import { onMount } from 'svelte';
	import { classroomService, userService } from '$lib/services';
	import type { Classroom } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { AcademicCapIcon } from '$lib/icons/outline';

	let classrooms: (Classroom & { teacherName?: string })[] = [];
	let teachers: any[] = [];
	let loading = true;
	let error = '';
	let showNewClassModal = false;
	let showLinkTeacherModal = false;
	let selectedClassroom: Classroom | null = null;
	let isSubmitting = false;

	let newClassroom = {
		nombre: '',
		descripcion: '',
		teacher_user_id: ''
	};

	onMount(async () => {
		try {
			// Cargar todas las clases
			const classroomsRes = await classroomService.getAll();
			classrooms = classroomsRes ?? [];

			// Cargar docentes activos
			teachers = await userService.getTeachers();

			// Mapear nombre de docente a cada clase
			const teacherMap = teachers.reduce(
				(acc, t) => ({ ...acc, [t._id]: t.username }),
				{} as Record<string, string>
			);

			classrooms = classrooms.map(c => ({
				...c,
				teacherName: teacherMap[c.teacher_user_id] || 'Sin asignar'
			}));

			loading = false;
		} catch (err: any) {
			error = err.message || 'Error al cargar las clases';
			loading = false;
		}
	});

	async function handleCreateClassroom() {
		if (!newClassroom.nombre) {
			error = 'El nombre de la clase es obligatorio';
			return;
		}

		isSubmitting = true;
		try {
			await classroomService.create({
				nombre: newClassroom.nombre,
				descripcion: newClassroom.descripcion,
				teacher_user_id: newClassroom.teacher_user_id || undefined
			});

			// Recargar lista
			const classroomsRes = await classroomService.getAll();
			classrooms = classroomsRes ?? [];

			const teacherMap = teachers.reduce(
				(acc, t) => ({ ...acc, [t._id]: t.username }),
				{} as Record<string, string>
			);

			classrooms = classrooms.map(c => ({
				...c,
				teacherName: teacherMap[c.teacher_user_id] || 'Sin asignar'
			}));

			// Reset form
			newClassroom = {
				nombre: '',
				descripcion: '',
				teacher_user_id: ''
			};
			showNewClassModal = false;
			error = '';
		} catch (err: any) {
			error = err.message || 'Error al crear clase';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleLinkTeacher() {
		if (!selectedClassroom || !newClassroom.teacher_user_id) {
			error = 'Debe seleccionar un docente';
			return;
		}

		isSubmitting = true;
		try {
			// Actualizar classroom con docente
			await classroomService.update(selectedClassroom._id || selectedClassroom.id, {
				teacher_user_id: newClassroom.teacher_user_id
			});

			// Recargar lista
			const classroomsRes = await classroomService.getAll();
			classrooms = classroomsRes ?? [];

			const teacherMap = teachers.reduce(
				(acc, t) => ({ ...acc, [t._id]: t.username }),
				{} as Record<string, string>
			);

			classrooms = classrooms.map(c => ({
				...c,
				teacherName: teacherMap[c.teacher_user_id] || 'Sin asignar'
			}));

			showLinkTeacherModal = false;
			selectedClassroom = null;
			newClassroom.teacher_user_id = '';
			error = '';
		} catch (err: any) {
			error = err.message || 'Error al enlazar docente';
		} finally {
			isSubmitting = false;
		}
	}

	function openLinkTeacherModal(classroom: Classroom) {
		selectedClassroom = classroom;
		newClassroom.teacher_user_id = classroom.teacher_user_id || '';
		showLinkTeacherModal = true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<Heading level="h1">Gestión de Classroom</Heading>
		<Button onclick={() => (showNewClassModal = true)}>+ Nueva Clase</Button>
	</div>

	{#if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
				<p class="text-gray-500">Cargando clases...</p>
			</div>
		</div>
	{:else if classrooms.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
			<AcademicCapIcon class="h-12 w-12 text-gray-400 mx-auto mb-4" />
			<p class="text-gray-500 dark:text-gray-400 mb-4">No hay clases de classroom registradas</p>
			<Button onclick={() => (showNewClassModal = true)}>Crear primera clase</Button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each classrooms as classroom (classroom._id)}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
					<div class="flex items-start justify-between mb-4">
						<div>
							<h3 class="text-lg font-bold text-gray-900 dark:text-white">{classroom.nombre}</h3>
							{#if classroom.created_at}
								<p class="text-xs text-gray-400">{new Date(classroom.created_at).toLocaleDateString('es-ES')}</p>
							{/if}
						</div>
						{#if classroom.activo}
							<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
								Activo
							</span>
						{:else}
							<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
								Inactivo
							</span>
						{/if}
					</div>

					{#if classroom.descripcion}
						<p class="text-sm text-gray-600 dark:text-gray-300 mb-4">{classroom.descripcion}</p>
					{/if}

					<div class="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-4">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Docente Asignado</p>
						<p class="text-sm font-medium text-gray-900 dark:text-white">
							{classroom.teacherName || 'Sin asignar'}
						</p>
					</div>

					<div class="flex gap-2">
						<button
							onclick={() => openLinkTeacherModal(classroom)}
							class="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
						>
							{classroom.teacher_user_id ? 'Cambiar Docente' : 'Asignar Docente'}
						</button>
						<button
							class="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
						>
							Ver Detalles
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Modal Nueva Clase -->
	{#if showNewClassModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Crear Nueva Clase</h2>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Nombre de la Clase *
						</label>
						<input
							type="text"
							bind:value={newClassroom.nombre}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Ej: Matemática Avanzada"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Descripción
						</label>
						<textarea
							bind:value={newClassroom.descripcion}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Descripción de la clase..."
							rows="3"
						></textarea>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Asignar Docente (Opcional)
						</label>
						<select
							bind:value={newClassroom.teacher_user_id}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">-- Sin docente --</option>
							{#each teachers as teacher}
								<option value={teacher._id}>{teacher.username}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex gap-3 mt-6">
					<button
						onclick={() => {
							showNewClassModal = false;
							newClassroom = {
								nombre: '',
								descripcion: '',
								codigo: '',
								docente_id: ''
							};
						}}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						onclick={handleCreateClassroom}
						disabled={isSubmitting}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSubmitting ? 'Creando...' : 'Crear Clase'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal Enlazar Docente -->
	{#if showLinkTeacherModal && selectedClassroom}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
					Enlazar Docente
				</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Clase: <span class="font-bold">{selectedClassroom.nombre}</span>
				</p>

				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Seleccionar Docente
					</label>
					<select
						bind:value={newClassroom.teacher_user_id}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">-- Sin docente --</option>
						{#each teachers as teacher}
							<option value={teacher._id}>{teacher.username}</option>
						{/each}
					</select>
				</div>

				<div class="flex gap-3">
					<button
						onclick={() => {
							showLinkTeacherModal = false;
							selectedClassroom = null;
							newClassroom.docente_id = '';
						}}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						onclick={handleLinkTeacher}
						disabled={isSubmitting}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSubmitting ? 'Guardando...' : 'Guardar'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
