<script lang="ts">
	import { onMount } from 'svelte';
	import { userService, courseService } from '$lib/services';
	import type { Role, User, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import UserForm from '$lib/features/users/UserForm.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon, AcademicCapIcon, UsersIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';
	import { userStore } from '$lib/stores/userStore';

	let currentUser: any = $state(null);

	userStore.subscribe(state => {
		currentUser = state.user;
	});

	let users: User[] = $state([]);
	let loading = $state(false);
	let error = $state('');
	
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Estado de filtro
	let selectedRoleFilter = $state('all');

	// ISSUE-R-VISTA-CURSOS: agrupación visual de usuarios "Globales" (sin
	// restricción de curso) vs "Asignados a curso(s)" (encargado_curso/
	// cobranza con cursos_asignados no vacío). Mapa id->nombre para mostrar
	// el nombre real del curso en vez del ObjectId crudo.
	let coursesById: Record<string, Course> = $state({});

	// Modal state
	let isFormOpen = $state(false);
	let selectedUser: User | null = $state(null);
	let showDeleteModal = $state(false);
	let userToDelete: User | null = $state(null);
	let deleteLoading = $state(false);

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	type UserApiResponse = User & {
		rol?: unknown;
		role?: unknown;
	};

	onMount(() => {
		loadUsers();
		loadCourses();
	});

	async function loadCourses() {
		try {
			// Mapa de referencia para nombres (no una tabla paginada). El backend
			// limita per_page a 100; se pagina en silencio si hay más cursos.
			const map: Record<string, Course> = {};
			let currentPage = 1;
			let hasMore = true;
			while (hasMore) {
				const result = await courseService.getAll(currentPage, 100);
				for (const c of result.data) {
					map[c._id] = c;
				}
				hasMore = result.meta.hasNextPage;
				currentPage += 1;
			}
			coursesById = map;
		} catch (e) {
			// AUDITORÍA: catch totalmente silencioso (sin log ni alerta al
			// usuario) -- si esto fallaba, los badges de curso quedaban
			// vacíos sin ninguna pista de que algo salió mal.
			console.error('Error al cargar el mapa de cursos para Usuarios', e);
			alert('error', 'No se pudieron cargar los nombres de los cursos asignados.');
			coursesById = {};
		}
	}

	function getCursoNombre(id: string): string {
		const curso = coursesById[id];
		return curso ? `${curso.nombre_programa} (${curso.codigo})` : id;
	}

	async function loadUsers() {
		loading = true;
		try {
			const result = await userService.getAll(page, limit);
			
			const response = result as any;
			if (response && response.data) {
				users = normalizeUsers(response.data);
				totalItems = response.meta.totalItems;
				totalPages = response.meta.totalPages;
			} else if (Array.isArray(response)) {
				users = normalizeUsers(response);
				totalItems = response.length;
				totalPages = 1;
			} else {
				users = [];
				totalItems = 0;
			}
		} catch (e: any) {
			error = e.message || 'Error al cargar usuarios';
			alert('error', error);
		} finally {
			loading = false;
		}
	}

	function normalizeUsers(value: unknown): User[] {
		if (!Array.isArray(value)) return [];

		return value
			.map(normalizeUser)
			.filter((user): user is User => Boolean(user));
	}

	function normalizeUser(user: UserApiResponse | null | undefined): User | null {
		if (!user) return null;

		return {
			...user,
			role: resolveUserRole(user)
		} as User;
	}

	function resolveUserRole(user: UserApiResponse): Role {
		const rawRole = user.role ?? user.rol;

		if (typeof rawRole === 'string' && rawRole.trim()) {
			return rawRole as Role;
		}

		return null;
	}

	// Mapeo estilizado de roles para la UAGRM
	function getRoleLabel(role: Role): string {
		if (!role) return 'Sin rol';

		const labels: Record<string, string> = {
			admin: 'Admin',
			superadmin: 'Superadmin',
			mae: 'MAE',
			cpd: 'CPD',
			cobranza: 'Cobranza',
			docente: 'Docente',
			student: 'Estudiante'
		};

		return labels[role] ?? role;
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadUsers();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadUsers();
	}

	function handleCreate() {
		selectedUser = null;
		isFormOpen = true;
	}

	function handleEdit(user: User) {
		selectedUser = user;
		isFormOpen = true;
	}

	function confirmDelete(user: User | null | undefined) {
		if (!user?._id) return;
		userToDelete = user;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (deleteLoading) return;

		const deletedUserId = userToDelete?._id;
		if (!deletedUserId) {
			showDeleteModal = false;
			userToDelete = null;
			return;
		}

		deleteLoading = true;
		try {
			await userService.delete(deletedUserId);
			alert('success', 'Usuario eliminado correctamente');
			users = users.filter((user) => user?._id !== deletedUserId);
			showDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar usuario');
		} finally {
			deleteLoading = false;
			userToDelete = null;
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadUsers();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(user: User) {
		return [
			{
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(user)
			},
			{
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(user),
				divider: true
			}
		];
	}

	// Filtro en memoria para evitar llamadas redundantes a la API (ya que gestionamos pocos administradores)
	let filteredUsers = $derived(
		selectedRoleFilter === 'all' 
			? users 
			: users.filter(u => u.role === selectedRoleFilter)
	);

	// ISSUE-R-VISTA-CURSOS: separación visual entre usuarios "Globales"
	// (sin restricción de curso: admin, superadmin, mae, cpd, docente, o
	// encargado_curso/cobranza sin cursos marcados aún) y "Asignados a
	// Curso" (tienen al menos un curso en cursos_asignados). Agrupación
	// client-side sobre la página actual, no cambia la paginación del backend.
	function tieneCursosAsignados(user: User): boolean {
		return Array.isArray(user.cursos_asignados) && user.cursos_asignados.length > 0;
	}

	let globalUsers = $derived(filteredUsers.filter((u) => !tieneCursosAsignados(u)));
	let assignedUsers = $derived(filteredUsers.filter((u) => tieneCursosAsignados(u)));
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Usuarios</Heading>
		<Button onclick={handleCreate}
				disabled={currentUser?.role !== 'superadmin'}
  				title={currentUser?.role !== 'superadmin'
    				? 'Solo el Super Administrador puede crear usuarios'
    				: 'Crear nuevo usuario'}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nuevo Usuario
		</Button>
	</div>

	<!-- Barra de Filtros -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center gap-4">
		<label for="role-filter" class="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por Perfil:</label>
		<select 
			id="role-filter"
			bind:value={selectedRoleFilter}
			class="block w-full sm:w-64 rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		>
			<option value="all">Todos los usuarios</option>
			<option value="superadmin">Superadmin (Soporte Técnico)</option>
			<option value="admin">Admin (General)</option>
			<option value="mae">MAE (Lector Directivo)</option>
			<option value="cpd">CPD (Académico)</option>
			<option value="cobranza">Cobranza (Financiero)</option>
		</select>
	</div>

	{#snippet userRow(user: User)}
		<tr>
			<td class="px-6 py-4 whitespace-nowrap">
				<div class="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
				{#if user.nombre_funcional}
					<div class="text-xs text-gray-500 dark:text-gray-400">{user.nombre_funcional}</div>
				{/if}
			</td>
			<td class="px-6 py-4 whitespace-nowrap">
				<div class="text-sm text-gray-900 dark:text-white">{user.email}</div>
			</td>
			<td class="px-6 py-4 whitespace-nowrap">
				<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
					{getRoleLabel(user.role)}
				</span>
			</td>
			<td class="px-6 py-4">
				{#if tieneCursosAsignados(user)}
					<div class="flex flex-wrap gap-1 max-w-xs">
						{#each user.cursos_asignados ?? [] as cursoId}
							<span
								class="px-2 inline-flex text-xs leading-5 font-medium rounded-full bg-light-tertiary/10 text-light-tertiary dark:bg-dark-tertiary/20 dark:text-dark-tertiary"
								title={getCursoNombre(cursoId)}
							>
								{getCursoNombre(cursoId)}
							</span>
						{/each}
					</div>
				{:else}
					<span class="text-xs text-gray-400 dark:text-gray-500">— Global (todos los cursos) —</span>
				{/if}
			</td>
			<td class="px-6 py-4 whitespace-nowrap">
				<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
					{user.activo ? 'Activo' : 'Inactivo'}
				</span>
			</td>
			<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
				<button onclick={() => toggleDropdown(user._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
					<DotsVerticalIcon class="size-5" />
				</button>
				{#if openDropdownId === user._id}
					<div class="absolute right-0 mt-2 w-48 z-10">
						<DropdownMenu 
							options={getDropdownOptions(user)} 
							isOpen={true} 
							width="w-48" 
							class="origin-top-right right-0"
						/>
					</div>
				{/if}
			</td>
		</tr>
	{/snippet}

	{#snippet userCard(user: User)}
		<Card>
			<div class="flex items-center justify-between mb-4">
				<div>
					<h3 class="text-sm font-medium text-gray-900 dark:text-white">{user.username}</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
					{#if user.nombre_funcional}
						<p class="text-xs text-gray-400 dark:text-gray-500">{user.nombre_funcional}</p>
					{/if}
				</div>
				<div class="relative">
					<button onclick={() => toggleDropdown(user._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
						<DotsVerticalIcon class="size-5" />
					</button>
					{#if openDropdownId === user._id}
						<div class="absolute right-0 mt-2 w-48 z-10">
							<DropdownMenu 
								options={getDropdownOptions(user)} 
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
					<span class="text-gray-500 dark:text-gray-400">Rol:</span>
					<span class="font-medium text-gray-900 dark:text-white">{getRoleLabel(user.role)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500 dark:text-gray-400">Estado:</span>
					<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
						{user.activo ? 'Activo' : 'Inactivo'}
					</span>
				</div>
				{#if tieneCursosAsignados(user)}
					<div class="pt-1">
						<span class="text-gray-500 dark:text-gray-400 block mb-1">Cursos asignados:</span>
						<div class="flex flex-wrap gap-1">
							{#each user.cursos_asignados ?? [] as cursoId}
								<span
									class="px-2 inline-flex text-xs leading-5 font-medium rounded-full bg-light-tertiary/10 text-light-tertiary dark:bg-dark-tertiary/20 dark:text-dark-tertiary"
								>
									{getCursoNombre(cursoId)}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</Card>
	{/snippet}

	{#if loading}
		<TableSkeleton columns={6} rows={10} />
	{:else if filteredUsers.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay usuarios registrados que coincidan con el filtro.</p>
		</div>
	{:else}
		<!-- ISSUE-R-VISTA-CURSOS: Grupo 1 — Usuarios Globales (sin restricción de curso) -->
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<UsersIcon class="size-5 text-light-tertiary dark:text-dark-tertiary" />
				<Heading level="h4">Usuarios Globales</Heading>
				<span class="text-xs text-gray-400 dark:text-gray-500">({globalUsers.length})</span>
			</div>
			<p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
				Sin restricción de curso: acceso a toda la plataforma según su rol (Admin, Superadmin, MAE, CPD,
				Docente) o Encargado de Curso/Cobranza aún sin cursos marcados.
			</p>

			{#if globalUsers.length === 0}
				<p class="text-sm text-gray-400 dark:text-gray-500 italic py-2">Ninguno con el filtro actual.</p>
			{:else}
				<!-- Desktop Table -->
				<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
					<table class="divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
						<thead class="bg-gray-50 dark:bg-gray-900">
							<tr>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuario</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cursos</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
								<th scope="col" class="relative px-6 py-3">
									<span class="sr-only">Acciones</span>
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each globalUsers as user}
								{@render userRow(user)}
							{/each}
						</tbody>
					</table>
				</div>
				<!-- Mobile Cards -->
				<div class="md:hidden grid grid-cols-1 gap-4">
					{#each globalUsers as user}
						{@render userCard(user)}
					{/each}
				</div>
			{/if}
		</div>

		<!-- ISSUE-R-VISTA-CURSOS: Grupo 2 — Usuarios Asignados a Curso(s) -->
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<AcademicCapIcon class="size-5 text-light-tertiary dark:text-dark-tertiary" />
				<Heading level="h4">Asignados a Curso(s)</Heading>
				<span class="text-xs text-gray-400 dark:text-gray-500">({assignedUsers.length})</span>
			</div>
			<p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
				Encargados de Curso y Cobranza con al menos un curso marcado: solo ven/operan dentro de esos cursos
				específicos.
			</p>

			{#if assignedUsers.length === 0}
				<p class="text-sm text-gray-400 dark:text-gray-500 italic py-2">Ninguno con el filtro actual.</p>
			{:else}
				<!-- Desktop Table -->
				<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
					<table class="divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
						<thead class="bg-gray-50 dark:bg-gray-900">
							<tr>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuario</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cursos</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
								<th scope="col" class="relative px-6 py-3">
									<span class="sr-only">Acciones</span>
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each assignedUsers as user}
								{@render userRow(user)}
							{/each}
						</tbody>
					</table>
				</div>
				<!-- Mobile Cards -->
				<div class="md:hidden grid grid-cols-1 gap-4">
					{#each assignedUsers as user}
						{@render userCard(user)}
					{/each}
				</div>
			{/if}
		</div>

		{#if !loading && users.length > 0}
			<Pagination
				currentPage={page}
				{totalPages}
				{totalItems}
				{limit}
				onPageChange={handlePageChange}
				onLimitChange={handleLimitChange}
			/>
		{/if}
	{/if}

	<!-- Create/Edit Modal -->
	<Modal
		isOpen={isFormOpen}
		title={selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-2xl"
	>
		<UserForm
			user={selectedUser}
			currentUserId={currentUser?._id}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<!-- Delete Modal -->
	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			userToDelete = null;
		}}
		loading={deleteLoading}
	/>
</div>
