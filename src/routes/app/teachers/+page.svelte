<script lang="ts">
	import { onMount } from 'svelte';
	import { userService, courseService } from '$lib/services';
	import type { User } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';

	const TEACHER_ROLE = 'docente';

	let teachers: User[] = $state([]); 
	let loading = $state(true);
	let error = $state('');
	
	let showNewTeacherModal = $state(false);
	let newTeacher = $state({
		username: '',
		email: '',
		password: '',
		role: TEACHER_ROLE
	});
	
	let showEditTeacherModal = $state(false);
	let editingTeacher: User | null = $state(null);
	let editTeacherData = $state({
		username: '',
		email: '',
		password: '',
		activo: true
	});

    let showModulesModal = $state(false);
    let selectedTeacherForModules: User | null = $state(null);
    let teacherModules: any[] = $state([]);
    let loadingModules = $state(false);

	let isSubmitting = $state(false);

	onMount(async () => {
		try {
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
			await userService.create({
				username: newTeacher.username,
				email: newTeacher.email,
				password: newTeacher.password,
				role: TEACHER_ROLE,
				activo: true
			});

			alert('success', 'Docente creado con éxito');
			teachers = await userService.getTeachers();

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
			password: '', 
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

    async function handleViewModules(teacher: User) {
        selectedTeacherForModules = teacher;
        showModulesModal = true;
        loadingModules = true;
        teacherModules = [];
        
        try {
            teacherModules = await courseService.getModulesByTeacher(teacher._id);
        } catch (err: any) {
            alert('error', err.message || 'Error al cargar los módulos del docente');
        } finally {
            loadingModules = false;
        }
    }

	function safeFormatCurrency(value: any) {
		if (value === null || value === undefined || isNaN(Number(value))) return 'Bs 0.00';
		return `Bs ${Number(value).toFixed(2)}`;
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
			<!-- SVG Seguro -->
			<svg class="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
			<p class="text-gray-500 dark:text-gray-400 mb-4">No hay docentes registrados</p>
			<Button onclick={() => (showNewTeacherModal = true)}>Crear primer docente</Button>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Docente</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Estado</th>
							<th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
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
										<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Activo</span>
									{:else}
										<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Inactivo</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onclick={() => handleViewModules(teacher)} class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2">Ver Módulos</button>
									<button onclick={() => handleEditTeacher(teacher)} class="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 mr-2">Editar</button>
									<button onclick={() => handleDeleteTeacher(teacher._id)} class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Eliminar</button>
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
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usuario</label>
						<input type="text" bind:value={newTeacher.username} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="nombre_usuario" />
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
						<input type="email" bind:value={newTeacher.email} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="docente@ejemplo.com" />
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contraseña</label>
						<input type="password" bind:value={newTeacher.password} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
					</div>
				</div>
				<div class="flex gap-3 mt-6">
					<button onclick={() => (showNewTeacherModal = false)} class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
					<button onclick={handleCreateTeacher} disabled={isSubmitting} class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{isSubmitting ? 'Creando...' : 'Crear Docente'}</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal Editar Docente -->
	{#if showEditTeacherModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Editar Docente</h2>
				<div class="space-y-4">
					<div>
						<label for="edit-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usuario</label>
						<input id="edit-username" type="text" bind:value={editTeacherData.username} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
					</div>
					<div>
						<label for="edit-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
						<input id="edit-email" type="email" bind:value={editTeacherData.email} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
					</div>
					<div>
						<label for="edit-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nueva Contraseña (Opcional)</label>
						<input id="edit-password" type="password" bind:value={editTeacherData.password} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dejar vacío para no cambiar" />
					</div>
					<div class="flex items-center gap-2 mt-4">
						<input type="checkbox" id="edit-activo" bind:checked={editTeacherData.activo} class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer" />
						<label for="edit-activo" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Docente Activo</label>
					</div>
				</div>
				<div class="flex gap-3 mt-6">
					<button onclick={() => { showEditTeacherModal = false; editingTeacher = null; }} class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
					<button onclick={handleSaveEditTeacher} disabled={isSubmitting} class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</button>
				</div>
			</div>
		</div>
	{/if}

    <!-- Modal Módulos Asignados (ISSUE R) -->
    {#if showModulesModal}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
							<!-- SVG Seguro -->
							<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
							</svg>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Módulos Asignados</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Docente: <span class="font-semibold">{selectedTeacherForModules?.username}</span></p>
                        </div>
                    </div>
                    <button onclick={() => { showModulesModal = false; selectedTeacherForModules = null; }} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors p-2">
                        <!-- SVG Seguro -->
						<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto p-6">
                    {#if loadingModules}
                        <div class="flex justify-center py-12">
                            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    {:else if teacherModules.length === 0}
                        <div class="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                            <p class="text-gray-500 dark:text-gray-400">Este docente no tiene ningún módulo asignado actualmente.</p>
                            <p class="text-sm text-gray-400 mt-2">Puedes asignarle módulos desde la sección de Cursos.</p>
                        </div>
                    {:else}
                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
							<div class="overflow-x-auto">
							<table class="min-w-[920px] lg:min-w-0 lg:w-full lg:table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                                <thead class="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Módulo</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Programa / Curso</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Costo (Bs)</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {#each teacherModules as module}
                                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
											<td class="px-6 py-4 whitespace-normal align-top">
												<div class="flex items-start gap-2 min-w-0">
													<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold dark:bg-indigo-900/30 dark:text-indigo-400 shrink-0">{module.modulo_index}</span>
													<span class="text-sm font-medium text-gray-900 dark:text-white max-w-[250px] break-words block min-w-0">{module.modulo_nombre}</span>
												</div>
											</td>
                                            <td class="px-6 py-4 whitespace-normal align-top">
                                                <span class="text-sm text-gray-600 dark:text-gray-300 max-w-[250px] break-words block" title={module.curso_nombre}>{module.curso_nombre}</span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">{module.curso_codigo}</span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                                                {safeFormatCurrency(module.modulo_costo)}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end rounded-b-lg">
                    <Button variant="secondary" onclick={() => { showModulesModal = false; selectedTeacherForModules = null; }}>Cerrar</Button>
                </div>
            </div>
        </div>
    {/if}
</div>
