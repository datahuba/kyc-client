<script lang="ts">
	import { courseService, discountService, userService } from '$lib/services';
	import type { CreateCourseRequest, Course, Discount, User } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
	import Toggle from '$lib/components/ui/toggle.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';
	import { onMount } from 'svelte';

	interface Props {
		course?: Course | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { course = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!course);
	let saving = $state(false);
	let discounts: Discount[] = $state([]);
	let teachers: User[] = $state([]);

	// ISSUE-REFACTOR (UI): validación inline por campo (estilo DiscountForm)
	// en vez de depender solo de alert() al fallar el submit.
	let errors: Record<string, string> = $state({});

	// BUG 3 FIX: Filtrado reactivo de descuentos para ocultar inactivos.
	// Soporta tanto booleanos (`activo: true`) como strings heredados (`estado: 'Activo'`)
	let activeDiscounts = $derived(
		discounts.filter((d: any) => d.activo === true || d.estado === 'Activo')
	);

	let formData: CreateCourseRequest = $state({
		codigo: '',
		nombre_programa: '',
		tipo_curso: 'curso',
		modalidad: 'presencial',
		costo_total_interno: 0,
		matricula_interno: 0,
		cargo_adicional_monto: null,
		cargo_adicional_concepto: '',
		cantidad_cuotas: 1,
		descuento_curso: 0,
		descuento_id: '',
		observacion: '',
		fecha_inicio: '',
		fecha_fin: '',
		activo: true,
		modulos: [{ nombre: 'Módulo 1', costo: 0, docente_id: '' }]
	});

	let prevCuotas = $state(1);
	let prevCostoTotal = $state(0);
	let trackedCourseId = $state<string | undefined>(undefined);

	// ISSUE F: Candado de Cálculo Manual vs Automático
	let autoCalculateModules = $state(true);

	// ISSUE-REFACTOR (UI): reemplaza el confirm() nativo del navegador por un
	// ModalConfirm propio del design system, para no romper la consistencia
	// visual con el resto de la app.
	let showDiscrepancyModal = $state(false);
	let discrepancyMessage = $state('');
	let pendingSubmitPayload: any = $state(null);

	onMount(async () => {
		try {
			const [resDiscounts, resTeachers] = await Promise.all([
				discountService.getAll(1, 100),
				userService.getTeachers()
			]);
			discounts = resDiscounts.data;
			teachers = resTeachers;
		} catch (e) {
			console.error('Error fetching data for course form', e);
		}
	});

	// Inicializador
	$effect(() => {
		const currentId = course ? course._id : '';
		if (currentId !== trackedCourseId) {
			if (course) {
				formData = {
					codigo: course.codigo,
					nombre_programa: course.nombre_programa,
					tipo_curso: course.tipo_curso,
					modalidad: course.modalidad,
					costo_total_interno: course.costo_total_interno,
					matricula_interno: course.matricula_interno,
					cargo_adicional_monto: course.cargo_adicional_monto ?? null,
					cargo_adicional_concepto: course.cargo_adicional_concepto ?? '',
					cantidad_cuotas: course.cantidad_cuotas,
					descuento_curso: course.descuento_curso,
					descuento_id: (course as any).descuento_id || '',
					observacion: course.observacion,
					fecha_inicio: course.fecha_inicio.split('T')[0],
					fecha_fin: course.fecha_fin.split('T')[0],
					activo: course.activo,
					modulos: course.modulos
						? course.modulos.map((m) => ({ ...m, docente_id: m.docente_id || '' }))
						: Array.from({ length: course.cantidad_cuotas || 1 }, (_, i) => ({
								nombre: `Módulo ${i + 1}`,
								costo: 0,
								docente_id: ''
							}))
				};
				prevCuotas = course.cantidad_cuotas;
				prevCostoTotal = course.costo_total_interno;

				autoCalculateModules = false;
			} else {
				formData = {
					codigo: '',
					nombre_programa: '',
					tipo_curso: 'curso',
					modalidad: 'presencial',
					costo_total_interno: 0,
					matricula_interno: 0,
					cargo_adicional_monto: null,
					cargo_adicional_concepto: '',
					cantidad_cuotas: 1,
					descuento_curso: 0,
					descuento_id: '',
					observacion: '',
					fecha_inicio: '',
					fecha_fin: '',
					activo: true,
					modulos: [{ nombre: 'Módulo 1', costo: 0, docente_id: '' }]
				};
				prevCuotas = 1;
				prevCostoTotal = 0;

				autoCalculateModules = true;
			}
			trackedCourseId = currentId;
			errors = {};
		}
	});

	// Cerebro Matemático Controlado (ISSUE F)
	$effect(() => {
		if (trackedCourseId === undefined || !autoCalculateModules) return;

		const count = formData.cantidad_cuotas || 0;
		const totalCosto = formData.costo_total_interno || 0;

		let changedArray = false;
		let newModulos = formData.modulos ? [...formData.modulos] : [];

		if (count !== newModulos.length) {
			if (count > newModulos.length) {
				while (newModulos.length < count) {
					newModulos.push({ nombre: `Módulo ${newModulos.length + 1}`, costo: 0, docente_id: '' });
				}
			} else {
				newModulos = newModulos.slice(0, count);
			}
			changedArray = true;
		}

		if (count !== prevCuotas || totalCosto !== prevCostoTotal) {
			const costoUnitario = count > 0 ? Number((totalCosto / count).toFixed(2)) : 0;
			newModulos = newModulos.map((m) => ({
				nombre: m.nombre,
				costo: costoUnitario,
				docente_id: m.docente_id
			}));
			changedArray = true;

			prevCuotas = count;
			prevCostoTotal = totalCosto;
		}

		if (changedArray) {
			formData.modulos = newModulos;
		}
	});

	// ISSUE-REFACTOR (UI): validación inline por campo antes de enviar.
	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};

		if (!formData.codigo?.trim()) {
			nuevosErrores.codigo = 'El código es obligatorio.';
		}
		if (!formData.nombre_programa?.trim() || formData.nombre_programa.trim().length < 3) {
			nuevosErrores.nombre_programa = 'El nombre del programa debe tener al menos 3 caracteres.';
		}
		if (!formData.fecha_inicio) {
			nuevosErrores.fecha_inicio = 'La fecha de inicio es obligatoria.';
		}
		if (!formData.fecha_fin) {
			nuevosErrores.fecha_fin = 'La fecha de fin es obligatoria.';
		}
		if (
			formData.fecha_inicio &&
			formData.fecha_fin &&
			new Date(formData.fecha_fin) < new Date(formData.fecha_inicio)
		) {
			nuevosErrores.fecha_fin = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
		}
		if (!formData.costo_total_interno || formData.costo_total_interno <= 0) {
			nuevosErrores.costo_total_interno = 'El costo total interno debe ser mayor a 0.';
		}
		if (formData.matricula_interno === null || formData.matricula_interno === undefined || formData.matricula_interno < 0) {
			nuevosErrores.matricula_interno = 'La matrícula interna no puede ser negativa.';
		}
		if (!formData.cantidad_cuotas || formData.cantidad_cuotas < 1) {
			nuevosErrores.cantidad_cuotas = 'Debe haber al menos 1 módulo/cuota.';
		}
		if (formData.modulos?.some((m) => !m.nombre?.trim())) {
			nuevosErrores.modulos = 'Todos los módulos deben tener un nombre.';
		}
		// ISSUE-P-PRECIO-UNICO: si se define un monto de cargo adicional, el
		// concepto es obligatorio (para que el estudiante sepa qué está pagando).
		if (
			formData.cargo_adicional_monto !== null &&
			formData.cargo_adicional_monto !== undefined &&
			Number(formData.cargo_adicional_monto) > 0 &&
			!formData.cargo_adicional_concepto?.trim()
		) {
			nuevosErrores.cargo_adicional_concepto = 'Indica el concepto del cargo adicional (ej: Taller de Excel Avanzado).';
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
			const payload = { ...formData };
			if (!payload.descuento_id) {
				if (isEditMode) {
					// En edición, enviar null explícito para remover descuento existente
					payload.descuento_id = null;
				} else {
					// En creación, omitir el campo cuando no hay descuento seleccionado
					delete payload.descuento_id;
				}
			}

			// ISSUE-P-PRECIO-UNICO: si no se definió monto, se envía null (sin
			// cargo adicional) en vez de 0, para no confundir "sin cargo" con
			// "cargo de 0 Bs".
			if (
				payload.cargo_adicional_monto === null ||
				payload.cargo_adicional_monto === undefined ||
				(payload.cargo_adicional_monto as any) === '' ||
				Number(payload.cargo_adicional_monto) <= 0
			) {
				payload.cargo_adicional_monto = null;
				payload.cargo_adicional_concepto = null;
			}

			payload.modulos = payload.modulos!.map((m) => {
				const mod = { ...m };
				if (!mod.docente_id) {
					delete mod.docente_id;
				}
				return mod;
			});

			// ISSUE F: Verificador de congruencia financiera
			const sumModulos = payload.modulos.reduce((acc, curr) => acc + Number(curr.costo), 0);
			if (!autoCalculateModules && sumModulos !== payload.costo_total_interno) {
				discrepancyMessage = `La suma manual de los módulos (Bs. ${sumModulos}) no coincide con el Costo Total (Bs. ${payload.costo_total_interno}). ¿Deseas guardar el programa con esta discrepancia?`;
				pendingSubmitPayload = payload;
				showDiscrepancyModal = true;
				saving = false;
				return;
			}

			await guardarCurso(payload);
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar el curso');
			saving = false;
		}
	}

	async function guardarCurso(payload: any) {
		saving = true;
		try {
			if (isEditMode && course) {
				const updatePayload = {
					...payload,
					inscritos: course.inscritos
				};
				await courseService.update(course._id, updatePayload);
				alert('success', 'Programa y módulos actualizados correctamente');
			} else {
				await courseService.create(payload);
				alert('success', 'Programa creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar el curso');
		} finally {
			saving = false;
		}
	}

	function handleConfirmDiscrepancy() {
		showDiscrepancyModal = false;
		if (pendingSubmitPayload) {
			guardarCurso(pendingSubmitPayload);
			pendingSubmitPayload = null;
		}
	}

	function handleCancelDiscrepancy() {
		showDiscrepancyModal = false;
		pendingSubmitPayload = null;
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<!-- SECCIÓN: Datos básicos -->
	<Card variant="ghost" padding="none">
		<Heading level="h4" class="mb-3">Datos Básicos</Heading>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Código"
				id="codigo"
				bind:value={formData.codigo}
				required
				placeholder="DIPL-2024-001"
				error={errors.codigo}
			/>
			<Input
				label="Nombre del Programa"
				id="nombre_programa"
				bind:value={formData.nombre_programa}
				required
				placeholder="Diplomado en..."
				error={errors.nombre_programa}
			/>

			<Select label="Tipo de Curso" bind:value={formData.tipo_curso} required>
				<option value="">Seleccione un tipo de curso</option>
				{#each [
					{ value: 'curso', label: 'Curso' },
					{ value: 'taller', label: 'Taller' },
					{ value: 'diplomado', label: 'Diplomado' },
					{ value: 'maestría', label: 'Maestría' },
					{ value: 'doctorado', label: 'Doctorado' },
					{ value: 'seminario', label: 'Seminario' },
					{ value: 'otro', label: 'Otro' }
				] as tipo_curso}
					<option value={tipo_curso.value}>{tipo_curso.label}</option>
				{/each}
			</Select>

			<Select label="Modalidad" bind:value={formData.modalidad} required>
				<option value="">Seleccione una modalidad</option>
				{#each [
					{ value: 'presencial', label: 'Presencial' },
					{ value: 'virtual', label: 'Virtual' },
					{ value: 'híbrido', label: 'Híbrido' }
				] as modalidad}
					<option value={modalidad.value}>{modalidad.label}</option>
				{/each}
			</Select>

			<Input
				label="Fecha Inicio"
				id="fecha_inicio"
				type="date"
				bind:value={formData.fecha_inicio}
				required
				error={errors.fecha_inicio}
			/>
			<Input
				label="Fecha Fin"
				id="fecha_fin"
				type="date"
				bind:value={formData.fecha_fin}
				required
				error={errors.fecha_fin}
			/>
		</div>
	</Card>

	<!-- SECCIÓN: Costo del Programa (precio único para todos los estudiantes) -->
	<Card variant="bordered" padding="md">
		<Heading level="h4" class="mb-3 text-primary-700 dark:text-dark-tertiary">Costo del Programa</Heading>
		<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
			Precio único: aplica por igual a todos los estudiantes, sin importar su lugar de procedencia.
		</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Costo Total (Colegiatura)"
				id="costo_total_interno"
				type="number"
				bind:value={formData.costo_total_interno}
				required
				error={errors.costo_total_interno}
			/>
			<Input
				label="Matrícula"
				id="matricula_interno"
				type="number"
				bind:value={formData.matricula_interno}
				required
				error={errors.matricula_interno}
			/>
		</div>
	</Card>

	<!-- SECCIÓN: Cargo adicional (ISSUE-P-PRECIO-UNICO, 2026-07-08) -->
	<!-- El precio del programa (costo total + matrícula) es el MISMO para
	     todos los estudiantes, sin distinción de procedencia. Este bloque es
	     para un gasto complementario OPCIONAL al programa en su conjunto
	     (ej. "Taller de Excel Avanzado" incluido, con un costo extra fijo
	     que se suma a lo que paga cada estudiante inscrito a este curso). -->
	<Card variant="bordered" padding="md">
		<Heading level="h4" class="mb-3 text-primary-700 dark:text-dark-tertiary">Cargo Adicional (Opcional)</Heading>
		<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
			Úsalo solo si este programa incluye un gasto complementario obligatorio (ej. un taller o
			capacitación necesaria) con un costo aparte de la colegiatura. Se suma al total a pagar de
			todos los estudiantes inscritos a este curso. Déjalo vacío si no aplica.
		</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Monto del Cargo Adicional (Bs)"
				id="cargo_adicional_monto"
				type="number"
				min="0"
				step="0.01"
				bind:value={formData.cargo_adicional_monto}
				placeholder="Ej: 100"
			/>
			<Input
				label="Concepto del Cargo Adicional"
				id="cargo_adicional_concepto"
				bind:value={formData.cargo_adicional_concepto}
				placeholder="Ej: Taller de Excel Avanzado"
				error={errors.cargo_adicional_concepto}
			/>
		</div>
	</Card>

	<!-- SECCIÓN: Estructura de pago -->
	<Card variant="ghost" padding="none">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Cantidad de Módulos (Cuotas)"
				id="cantidad_cuotas"
				type="number"
				min="1"
				bind:value={formData.cantidad_cuotas}
				required
				error={errors.cantidad_cuotas}
			/>

			<!-- BUG 3 FIX: Iteración sobre activeDiscounts en lugar de discounts -->
			<Select label="Descuento Global" bind:value={formData.descuento_id}>
				<option value="">Ninguno</option>
				{#each activeDiscounts as discount}
					<option value={discount._id}>{discount.nombre} ({discount.porcentaje}%)</option>
				{/each}
			</Select>
		</div>
	</Card>

	<!-- SECCIÓN DINÁMICA DE MÓDULOS CON ASIGNACIÓN DE DOCENTES -->
	{#if formData.modulos && formData.modulos.length > 0}
		<Card variant="bordered" padding="md">
			<div
				class="mb-4 flex flex-col items-start justify-between gap-2 border-b border-gray-200 pb-3 sm:flex-row sm:items-center dark:border-gray-700"
			>
				<Heading level="h4" class="text-primary-700 dark:text-dark-tertiary">Configuración de Módulos y Docentes</Heading>

				<Toggle
					bind:checked={autoCalculateModules}
					labelOn="Cálculo Auto"
					labelOff="Edición Manual"
				/>
			</div>

			{#if errors.modulos}
				<p class="mb-3 text-sm text-light-error">{errors.modulos}</p>
			{/if}

			<div class="grid grid-cols-1 gap-4">
				{#each formData.modulos as modulo, i}
					<div
						class="flex flex-col items-center gap-4 rounded-md border border-gray-100 bg-white p-3 shadow-sm transition-colors xl:flex-row dark:border-gray-700 dark:bg-gray-800 {autoCalculateModules
							? 'opacity-80'
							: ''}"
					>
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-400 dark:bg-gray-700"
							>{i + 1}</span
						>
						<div class="w-full xl:w-2/5">
							<Input
								label="Nombre del Módulo"
								id={`modulo_nombre_${i}`}
								bind:value={formData.modulos[i].nombre}
								required
								placeholder="Ej: Introducción a la IA"
							/>
						</div>
						<div class="w-full xl:w-1/5">
							<Input
								label="Costo (Bs)"
								id={`modulo_costo_${i}`}
								type="number"
								bind:value={formData.modulos[i].costo}
								required
								placeholder="Ej: 588"
								readonly={autoCalculateModules}
								class={autoCalculateModules
									? 'bg-gray-100 text-gray-500 border-dashed dark:bg-gray-900'
									: 'border-primary-300 font-semibold dark:border-primary-700'}
							/>
						</div>
						<div class="w-full xl:w-2/5">
							<Select label="Docente Titular (Opcional)" bind:value={formData.modulos[i].docente_id}>
								<option value="">Sin asignar</option>
								{#each teachers as teacher}
									<option value={teacher._id}>{teacher.username} ({teacher.email})</option>
								{/each}
							</Select>
						</div>
					</div>
				{/each}
			</div>
			{#if autoCalculateModules}
				<p
					class="mt-3 flex items-center gap-1.5 rounded-md bg-uagrm-sky/10 p-2 text-xs text-uagrm-sky"
				>
					<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					El sistema está prorrateando el costo equitativamente. Cambia el switch superior a "Edición
					Manual" para alterar los precios y no perder los cambios.
				</p>
			{/if}
		</Card>
	{/if}

	<!-- SECCIÓN: Observación y estado -->
	<Card variant="ghost" padding="none">
		<TextArea label="Observación" id="observacion" bind:value={formData.observacion} rows={3} />
		<Checkbox class="mt-4" id="activo" label="Curso Activo" bind:checked={formData.activo} />
	</Card>

	<div class="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>Cancelar</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>

<ModalConfirm
	isOpen={showDiscrepancyModal}
	message={discrepancyMessage}
	onConfirm={handleConfirmDiscrepancy}
	onCancel={handleCancelDiscrepancy}
	loading={saving}
/>
