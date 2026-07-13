<script lang="ts">
	import { userService, courseService } from '$lib/services';
	import type { CreateUserRequest, UserResponse } from '$lib/interfaces';
	import type { Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
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

	// ISSUE-REFACTOR (UI): validación inline por campo (estilo CourseForm/StudentForm)
	// en vez de depender solo de un único mensaje mostrado con alert().
	let errors: Record<string, string> = $state({});

	let formData: CreateUserRequest = $state({
		username: '',
		email: '',
		password: '',
		role: null,
		activo: true,
		nombre_funcional: '',
		cursos_asignados: [],
		carnet: '',
		subtipo_coordinador: ''
	});

	// GAP-1 (audio 2026-07-08): si se completa el CI y se deja la contraseña en
	// blanco al crear, el backend genera automáticamente 'Uagrm.<CI>' como
	// contraseña inicial (convención institucional confirmada por el usuario).
	let passwordAutogenerada = $derived(
		!isEditMode && !!formData.carnet?.trim() && !formData.password?.trim()
	);

	// ISSUE-R-ROLES / ISSUE-R-PERFIL-GENERICO: roles que requieren nombre funcional
	// (por función/programa, no por persona) para poder rotar al responsable sin
	// perder historial ni migrar datos entre cuentas.
	const ROLES_CON_NOMBRE_FUNCIONAL = ['encargado_curso', 'coordinador', 'cobranza'];
	let requiereNombreFuncional = $derived(
		!!formData.role && ROLES_CON_NOMBRE_FUNCIONAL.includes(formData.role)
	);
	// Obligatorio solo para Encargado de Curso (siempre segmentado).
	let requiereCursosAsignados = $derived(formData.role === 'encargado_curso');
	// ISSUE-R-PERFIL-GENERICO: el Coordinador requiere subtipo (financiero/académico/investigación).
	let requiereSubtipoCoordinador = $derived(formData.role === 'coordinador');
	// Cobranza también puede asignarse a programas, pero es OPCIONAL: si no se
	// marca ninguno, ve/gestiona todos los pagos (comportamiento general);
	// si se marcan, queda segmentado a esos programas (ISSUE-P-SEGMENTACION).
	let permiteCursosAsignados = $derived(
		formData.role === 'encargado_curso' || formData.role === 'cobranza'
	);

	let cursosDisponibles: Course[] = $state([]);

	$effect(() => {
		// Cargar cursos activos una sola vez, se usan en el multi-select de
		// Encargado de Curso. El backend limita per_page a 100 (422 si se
		// supera), por eso se pagina en silencio si hay más de 100 cursos.
		(async () => {
			try {
				const todos: Course[] = [];
				let currentPage = 1;
				let hasMore = true;
				while (hasMore) {
					const res = await courseService.getAll(currentPage, 100, { activo: true });
					todos.push(...res.data);
					hasMore = res.meta.hasNextPage;
					currentPage += 1;
				}
				cursosDisponibles = todos;
			} catch {
				cursosDisponibles = [];
			}
		})();
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
				cursos_asignados: user.cursos_asignados ?? [],
				carnet: user.carnet ?? '',
				subtipo_coordinador: user.subtipo_coordinador ?? ''
			};
		} else {
			formData = {
				username: '',
				email: '',
				password: '',
				role: null,
				activo: true,
				nombre_funcional: '',
				cursos_asignados: [],
				carnet: '',
				subtipo_coordinador: ''
			};
		}
		errors = {};
	});

	function toggleCurso(cursoId: string) {
		const actuales = formData.cursos_asignados ?? [];
		if (actuales.includes(cursoId)) {
			formData.cursos_asignados = actuales.filter((id) => id !== cursoId);
		} else {
			formData.cursos_asignados = [...actuales, cursoId];
		}
	}

	// ISSUE-REFACTOR (UI): validación inline por campo antes de enviar.
	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};

		if (!formData.username?.trim()) {
			nuevosErrores.username = 'El nombre de usuario es obligatorio.';
		}
		if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
			nuevosErrores.email = 'Ingresa un correo electrónico válido.';
		}
		if (!formData.role) {
			nuevosErrores.role = 'Selecciona un rol.';
		}
		if (formData.carnet?.trim() && !/^\d{5,10}$/.test(formData.carnet.trim())) {
			nuevosErrores.carnet = 'El carnet debe tener entre 5 y 10 dígitos (solo números).';
		}
		// GAP-1: al crear, la contraseña es obligatoria SALVO que se provea un
		// carnet (en ese caso el backend la autogenera como 'Uagrm.<CI>').
		// Si se escribe una contraseña de todos modos, debe cumplir el mínimo.
		if (!isEditMode) {
			const tieneCarnet = !!formData.carnet?.trim();
			const tienePassword = !!formData.password?.trim();
			if (tienePassword && formData.password!.length < 5) {
				nuevosErrores.password = 'La contraseña debe tener al menos 5 caracteres.';
			} else if (!tienePassword && !tieneCarnet) {
				nuevosErrores.password = 'La contraseña debe tener al menos 5 caracteres, o completa el Carnet de Identidad para generarla automáticamente.';
			}
		}
		if (requiereNombreFuncional && !formData.nombre_funcional?.trim()) {
			nuevosErrores.nombre_funcional = 'El nombre funcional es obligatorio para Encargado de Curso, Coordinador y Cobranza.';
		}
		if (requiereCursosAsignados && (formData.cursos_asignados ?? []).length === 0) {
			nuevosErrores.cursos_asignados = 'Selecciona al menos un curso para este Encargado de Curso.';
		}
		if (requiereSubtipoCoordinador && !formData.subtipo_coordinador) {
			nuevosErrores.subtipo_coordinador = 'Selecciona el subtipo del Coordinador (financiero, académico o investigación).';
		}

		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit() {
		if (!validarFormulario()) {
			alert('error', 'Revisa los campos marcados en rojo antes de continuar.');
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

			// Si el rol no requiere estos campos, no los enviamos con basura residual.
			// GAP-1: 'password' y 'carnet' vacíos se envían como undefined (una
			// cadena vacía '' rompería la validación min_length=5 del backend).
			const payload: CreateUserRequest = {
				...formData,
				password: formData.password?.trim() || undefined,
				carnet: formData.carnet?.trim() || undefined,
				nombre_funcional: requiereNombreFuncional ? formData.nombre_funcional : undefined,
				cursos_asignados: permiteCursosAsignados ? formData.cursos_asignados : undefined,
				subtipo_coordinador: requiereSubtipoCoordinador ? formData.subtipo_coordinador : undefined
			};

			if (isEditMode && user) {
				await userService.update(user._id, payload);
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
	<Card variant="ghost" padding="none">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<Input
				label="Nombre de Usuario"
				id="username"
				bind:value={formData.username}
				required
				placeholder="usuario1"
				error={errors.username}
			/>
			<Input
				label="Email"
				id="email"
				type="email"
				bind:value={formData.email}
				required
				placeholder="usuario@kyc.com"
				error={errors.email}
			/>

			<!-- GAP-1 (audio 2026-07-08): CI del personal. Si se completa al crear
			     y se deja la contraseña en blanco, el backend genera automáticamente
			     'Uagrm.<CI>' como contraseña inicial (convención institucional). -->
			<div>
				<Input
					label="Carnet de Identidad (CI)"
					id="carnet"
					bind:value={formData.carnet}
					inputmode="numeric"
					pattern="[0-9]*"
					minlength={5}
					maxlength={10}
					placeholder="Ej: 1234567"
					error={errors.carnet}
				/>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Opcional. Si lo completas y dejas la contraseña en blanco al crear, la contraseña inicial
					será <span class="font-mono">Uagrm.{formData.carnet?.trim() || '<CI>'}</span>.
				</p>
			</div>

			<!-- ISSUE L/M/R: Selector de Roles alineado a la jerarquía de Posgrado UAGRM -->
			<div>
				<Select
					label="Rol"
					bind:value={formData.role}
					disabled={disableRoleSelect}
					required
					error={errors.role}
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
					<p class="mt-1 text-xs text-light-warning dark:text-dark-warning">
						No puedes cambiar tu propio rol.
					</p>
				{/if}
			</div>

			{#if !isEditMode}
				<div>
					<Input
						label="Contraseña"
						id="password"
						type="password"
						bind:value={formData.password}
						required={!formData.carnet?.trim()}
						placeholder={formData.carnet?.trim() ? 'Opcional si completas el CI' : '********'}
						error={errors.password}
					/>
					{#if passwordAutogenerada}
						<p class="mt-1 text-xs text-light-tertiary dark:text-dark-tertiary">
							Se generará automáticamente como <span class="font-mono">Uagrm.{formData.carnet?.trim()}</span>.
						</p>
					{/if}
				</div>
			{:else}
				<Input
					label="Nueva Contraseña (Opcional)"
					id="password"
					type="password"
					bind:value={formData.password}
					placeholder="Dejar en blanco para mantener actual"
					error={errors.password}
				/>
			{/if}

			{#if requiereNombreFuncional}
				<div class="md:col-span-2">
					<Input
						label="Nombre Funcional (por función/programa, no por persona)"
						id="nombre_funcional"
						bind:value={formData.nombre_funcional}
						required
						placeholder="Ej: Encargado Maestría Gerencia Tributaria / Cajero Ventanilla 1"
						error={errors.nombre_funcional}
					/>
					{#if !errors.nombre_funcional}
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Este nombre es visible en notificaciones y reportes; permite rotar al responsable sin
							perder el historial.
						</p>
					{/if}
				</div>
			{/if}

			{#if requiereSubtipoCoordinador}
				<div class="md:col-span-2">
					<Select label="Subtipo de Coordinador" bind:value={formData.subtipo_coordinador} required error={errors.subtipo_coordinador}>
						<option value="">— Seleccione —</option>
						<option value="financiero">Financiero (ve lo económico)</option>
						<option value="academico">Académico</option>
						<option value="investigacion">Investigación</option>
					</Select>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Solo el Coordinador <strong>Financiero</strong> tiene acceso a reportes de caja e ingresos.
					</p>
				</div>
			{/if}

			{#if permiteCursosAsignados}
				<div class="md:col-span-2">
					<span class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Programas Asignados {#if requiereCursosAsignados}<span class="text-light-error">*</span>{:else}<span class="text-xs font-normal text-gray-400">(opcional)</span>{/if}
					</span>
					<div
						class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-light-four bg-white p-3 dark:border-dark-border dark:bg-dark-surface {errors.cursos_asignados
							? 'border-light-error dark:border-dark-error'
							: ''}"
					>
						{#if cursosDisponibles.length === 0}
							<p class="text-sm text-gray-500 dark:text-gray-400">No hay cursos activos disponibles.</p>
						{:else}
							{#each cursosDisponibles as curso (curso._id)}
								<Checkbox
									id={`curso_${curso._id}`}
									label={`${curso.nombre_programa} (${curso.codigo})`}
									checked={(formData.cursos_asignados ?? []).includes(curso._id)}
									onchange={() => toggleCurso(curso._id)}
								/>
							{/each}
						{/if}
					</div>
					{#if errors.cursos_asignados}
						<p class="mt-1 text-sm text-light-error">{errors.cursos_asignados}</p>
					{:else if formData.role === 'cobranza'}
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Opcional. Si no marcas ningún programa, verá y gestionará los pagos de <strong>todos</strong>
							los programas. Si marcas uno o varios, quedará segmentado solo a esos.
						</p>
					{:else}
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Este usuario solo verá e inscribirá estudiantes en los programas marcados.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</Card>

	<Card variant="ghost" padding="none">
		<Checkbox id="activo" label="Usuario Activo" bind:checked={formData.activo} disabled={disableActivoCheckbox} />
		{#if disableActivoCheckbox}
			<p class="mt-1 ml-6 text-xs text-light-warning dark:text-dark-warning">
				No puedes desactivar tu propia cuenta.
			</p>
		{/if}
	</Card>

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-dark-border">
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
