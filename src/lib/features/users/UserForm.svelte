<script lang="ts">
	import { userService, courseService } from '$lib/services';
	import type { CreateUserRequest, UserResponse } from '$lib/interfaces';
	import type { Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';

interface Props {
		user?: UserResponse | null;
		currentUserId?: string | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { user = null, currentUserId = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!user);
	let isEditingSelf = $derived(!!user && !!currentUserId && user._id === currentUserId);
	let disableActivoCheckbox = $derived(isEditMode && isEditingSelf);
	let disableRoleSelect = $derived(isEditMode && isEditingSelf);
	let saving = $state(false);

	let formData: CreateUserRequest = $state({
		username: '',
		email: '',
		password: '',
		role: null,
		activo: true,
		nombre_funcional: '',
		cursos_asignados: []
	});

	// ISSUE-R-ROLES: roles que requieren nombre funcional (por función/programa, no por persona)
	const ROLES_CON_NOMBRE_FUNCIONAL = ['encargado_curso', 'coordinador'];
	let requiereNombreFuncional = $derived(
		!!formData.role && ROLES_CON_NOMBRE_FUNCIONAL.includes(formData.role)
	);
	let requiereCursosAsignados = $derived(formData.role === 'encargado_curso');

	let cursosDisponibles: Course[] = $state([]);
	let errorNombreFuncional = $state('');

	$effect(() => {
		// Cargar cursos activos una sola vez, se usan en el multi-select de Encargado de Curso
		courseService.getAll(1, 200, { activo: true }).then((res) => {
			cursosDisponibles = res.data;
		}).catch(() => {
			cursosDisponibles = [];
		});
	});

	$effect(() => {
		if (user) {
			formData = {
				username: user.username,
				email: user.email,
				password: '', // Don't populate password
				role: user.role,
				activo: user.activo,
				nombre_funcional: user.nombre_funcional ?? '',
				cursos_asignados: user.cursos_asignados ?? []
			};
		} else {
			formData = {
				username: '',
				email: '',
				password: '',
				role: null,
				activo: true,
				nombre_funcional: '',
				cursos_asignados: []
			};
		}
	});

	function toggleCurso(cursoId: string) {
		const actuales = formData.cursos_asignados ?? [];
		if (actuales.includes(cursoId)) {
			formData.cursos_asignados = actuales.filter((id) => id !== cursoId);
		} else {
			formData.cursos_asignados = [...actuales, cursoId];
		}
	}

	function validarFormulario(): boolean {
		errorNombreFuncional = '';
		if (requiereNombreFuncional && !formData.nombre_funcional?.trim()) {
			errorNombreFuncional = 'El nombre funcional es obligatorio para Encargado de Curso y Coordinador.';
			return false;
		}
		return true;
	}

	async function handleSubmit() {
		if (!validarFormulario()) {
			return;
		}

		saving = true;
		try {
			if (isEditMode && isEditingSelf && formData.activo === false) {
				alert('error', 'No puedes desactivar tu propia cuenta.');
				return;
			}

			if (isEditMode && isEditingSelf && user && formData.role !== user.role) {
				alert('error', 'No puedes cambiar tu propio rol.');
				return;
			}

			// Si el rol no requiere estos campos, no los enviamos con basura residual
			const payload: CreateUserRequest = {
				...formData,
				nombre_funcional: requiereNombreFuncional ? formData.nombre_funcional : undefined,
				cursos_asignados: requiereCursosAsignados ? formData.cursos_asignados : undefined
			};

			if (isEditMode && user) {
				await userService.update(user._id, {
					...payload,
					password: formData.password || undefined
				});
				alert('success', 'Usuario actualizado correctamente');
			} else {
				await userService.create(payload);
				alert('success', 'Usuario creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar usuario');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<Input
			label="Nombre de Usuario"
			id="username"
			bind:value={formData.username}
			required
			placeholder="usuario1"
		/>
		<Input
			label="Email"
			id="email"
			type="email"
			bind:value={formData.email}
			required
			placeholder="usuario@kyc.com"
		/>
		
		<!-- ISSUE L/M/R: Selector de Roles alineado a la jerarquía de Postgrado UAGRM -->
		<Select
			label="Rol"
			bind:value={formData.role}
			disabled={disableRoleSelect}
			required
		>
			<option value="superadmin">Superadmin (Soporte Técnico)</option>
			<option value="admin">Administrador General</option>
			<option value="mae">MAE (Decano / Director / JAF)</option>
			<option value="cpd">CPD (Gestión Académica)</option>
			<option value="cobranza">Cobranza (Cuentas por Cobrar)</option>
			<option value="coordinador">Coordinador (Área)</option>
			<option value="encargado_curso">Encargado de Curso/Programa</option>
			<option value="docente">Docente</option>
		</Select>

		{#if disableRoleSelect}
			<p class="-mt-3 text-xs text-amber-600 dark:text-amber-400 md:col-span-2">
				No puedes cambiar tu propio rol.
			</p>
		{/if}

		{#if requiereNombreFuncional}
			<div class="md:col-span-2">
				<Input
					label="Nombre Funcional (por función/programa, no por persona)"
					id="nombre_funcional"
					bind:value={formData.nombre_funcional}
					required
					placeholder="Ej: Encargado Maestría Gerencia Tributaria"
				/>
				{#if errorNombreFuncional}
					<p class="mt-1 text-xs text-red-600 dark:text-red-400">{errorNombreFuncional}</p>
				{:else}
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Este nombre es visible en notificaciones y reportes; permite rotar al responsable sin
						perder el historial.
					</p>
				{/if}
			</div>
		{/if}

		{#if requiereCursosAsignados}
			<div class="md:col-span-2">
				<span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Cursos Asignados
				</span>
				<div
					class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-300 p-3 dark:border-gray-600"
				>
					{#if cursosDisponibles.length === 0}
						<p class="text-sm text-gray-500 dark:text-gray-400">No hay cursos activos disponibles.</p>
					{:else}
						{#each cursosDisponibles as curso (curso._id)}
							<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
								<input
									type="checkbox"
									checked={(formData.cursos_asignados ?? []).includes(curso._id)}
									onchange={() => toggleCurso(curso._id)}
									class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
								/>
								{curso.nombre_programa} ({curso.codigo})
							</label>
						{/each}
					{/if}
				</div>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Este usuario solo verá e inscribirá estudiantes en los cursos marcados.
				</p>
			</div>
		{/if}

		{#if !isEditMode}
			<Input
				label="Contraseña"
				id="password"
				type="password"
				bind:value={formData.password}
				required={!isEditMode}
				placeholder="********"
			/>
		{:else}
			<Input
				label="Nueva Contraseña (Opcional)"
				id="password"
				type="password"
				bind:value={formData.password}
				placeholder="Dejar en blanco para mantener actual"
			/>
		{/if}
	</div>

	<div class="flex items-center gap-2 pt-4">
		<input
			type="checkbox"
			id="activo"
			bind:checked={formData.activo}
			disabled={disableActivoCheckbox}
			class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
		/>
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Usuario Activo
		</label>
	</div>

	{#if disableActivoCheckbox}
		<p class="-mt-3 text-xs text-amber-600 dark:text-amber-400">
			No puedes desactivar tu propia cuenta.
		</p>
	{/if}

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>
			Cancelar
		</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>
