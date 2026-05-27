<script lang="ts">
	import { onMount } from 'svelte';
	import { userService } from '$lib/services';
	import type { User } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { goto } from '$app/navigation';
	import { UsersIcon } from '$lib/icons/outline';
	import { alert } from '$lib/utils'; // <-- IMPORTADO PARA MENSAJES DE TOAST

	const TEACHER_ROLE = 'docente';

	let teachers: User[] = [];
	let loading = true;
	let error = '';
	let showNewTeacherModal = false;
	let newTeacher = {
		username: '',
		email: '',
		password: '',
		role: TEACHER_ROLE
	};
	let isSubmitting = false;

	onMount(async () => {
		try {
			// Obtener solo docentes activos
			teachers = await userService.getTeachers();
			loading = false;
		} catch (err: any) {
			error = err.message || 'Error al cargar docentes';
			loading = false;
		}
	});

	async function handleCreateTeacher() {
		if (!newTeacher.username || !newTeacher.email || !newTeacher.password) {
			error = 'Todos los campos son obligatorios';
			return;
		}

		isSubmitting = true;
		try {
			// Crear usuario como docente
			await userService.create({
				username: newTeacher.username,
				email: newTeacher.email,
				password: newTeacher.password,
				role: TEACHER_ROLE,
				activo: true
			});

			alert('success', 'Docente creado con éxito');
			teachers = await userService.getTeachers();

			// Reset form
			newTeacher = {
				username: '',
				email: '',
				password: '',
				role: TEACHER_ROLE
			};
			showNewTeacherModal = false;
			error = '';
		} catch (err: any) {
			error = err.message || 'Error al crear docente';
		} finally {
			isSubmitting = false;
		}
	}

	function handleEditTeacher(teacher: User) {
		editingTeacher = teacher;
		editTeacherData = {
			username: teacher.username,
			email: teacher.email,
			password: '', // Se deja vacío para opcionalidad
			activo: teacher.activo
		};
		showEditTeacherModal = true;
		error = '';
	}

	async function handleSaveEditTeacher() {
		if (!editingTeacher) return;
		if (!editTeacherData.username || !editTeacherData.email) {
			error = 'Usuario y Email son obligatorios';
			return;
		}

		isSubmitting = true;
		try {
			await userService.update(editingTeacher._id, {
				username: editTeacherData.username,
				email: editTeacherData.email,
				password: editTeacherData.password || undefined,
				activo: editTeacherData.activo
			});

			alert('success', 'Docente actualizado correctamente');
			teachers = await userService.getTeachers();
			showEditTeacherModal = false;
			editingTeacher = null;
			error = '';
		} catch (err: any) {
			error = err.message || 'Error al actualizar docente';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteTeacher(id: string) {
		if (confirm('¿Está seguro de que desea eliminar a este docente?')) {
			try {
				await userService.delete(id);
				alert('success', 'Docente eliminado correctamente');
				teachers = teachers.filter((t) => t._id !== id);
			} catch (err: any) {
				alert('error', err.message || 'Error al eliminar docente');
			}
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<Heading level="h1">Gestión de Docentes</Heading>
		<Button onclick={() => (showNewTeacherModal = true)}>+ Nuevo Docente</Button>
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
				<p class="text-gray-500">Cargando docentes...</p>
			</div>
		</div>
	{:else if teachers.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
			<UsersIcon class="h-12 w-12 text-gray-400 mx-auto mb-4" />
			<p class="text-gray-500 dark:text-gray-400 mb-4">No hay docentes registrados</p>
			<Button onclick={() => (showNewTeacherModal = true)}>Crear primer docente</Button>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
								Docente
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
								Email
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
								Estado
							</th>
							<th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
								Acciones
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each teachers as teacher (teacher._id)}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										<div class="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
											{teacher.username.charAt(0).toUpperCase()}
										</div>
										<div class="ml-3">
											<p class="text-sm font-medium text-gray-900 dark:text-white">{teacher.username}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400">ID: {teacher._id.slice(0, 8)}</p>
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<p class="text-sm text-gray-600 dark:text-gray-300">{teacher.email}</p>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if teacher.activo}
										<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
											Activo
										</span>
									{:else}
										<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
											Inactivo
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
									<button
										onclick={() => handleEditTeacher(teacher)}
										class="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 mr-2"
									>
										Editar
									</button>
									<button
										onclick={() => goto(`/app/classroom?teacher_id=${teacher._id}`)}
										class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
									>
										Ver clases
									</button>
									<button
										onclick={() => handleDeleteTeacher(teacher._id)}
										class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
									>
										Eliminar
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Modal Nuevo Docente -->
	{#if showNewTeacherModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Crear Nuevo Docente</h2>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Usuario
						</label>
						<input
							type="text"
							bind:value={newTeacher.username}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="nombre_usuario"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Email
						</label>
						<input
							type="email"
							bind:value={newTeacher.email}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="docente@ejemplo.com"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Contraseña
						</label>
						<input
							type="password"
							bind:value={newTeacher.password}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="••••••••"
						/>
					</div>
				</div>

				<div class="flex gap-3 mt-6">
					<button
						onclick={() => (showNewTeacherModal = false)}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						onclick={handleCreateTeacher}
						disabled={isSubmitting}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSubmitting ? 'Creando...' : 'Crear Docente'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal Editar Docente (Implementado para Bug 4 / Solicitud CPD) -->
	{#if showEditTeacherModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Editar Docente</h2>

				<div class="space-y-4">
					<div>
						<label for="edit-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Usuario
						</label>
						<input
							id="edit-username"
							type="text"
							bind:value={editTeacherData.username}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label for="edit-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Email
						</label>
						<input
							id="edit-email"
							type="email"
							bind:value={editTeacherData.email}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label for="edit-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Nueva Contraseña (Opcional)
						</label>
						<input
							id="edit-password"
							type="password"
							bind:value={editTeacherData.password}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Dejar vacío para no cambiar"
						/>
					</div>

					<div class="flex items-center gap-2 mt-4">
						<input
							type="checkbox"
							id="edit-activo"
							bind:checked={editTeacherData.activo}
							class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
						/>
						<label for="edit-activo" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
							Docente Activo
						</label>
					</div>
				</div>

				<div class="flex gap-3 mt-6">
					<button
						onclick={() => { showEditTeacherModal = false; editingTeacher = null; }}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						Cancelar
					</button>
					<button
						onclick={handleSaveEditTeacher}
						disabled={isSubmitting}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
