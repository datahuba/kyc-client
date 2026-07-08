<script lang="ts">
	import { enrollmentService, discountService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';
	import { ExclamationCircleIcon } from '$lib/icons/solid';
	import type { Course, CreateEnrollmentRequest, Enrollment, Student, Discount } from '$lib/interfaces';
	import { onMount } from 'svelte';

	interface Props {
		enrollment?: Enrollment | null;
		students: Student[];
		courses: Course[];
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { enrollment = null, students = [], courses = [], onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!enrollment);
	let saving = $state(false);
	let discounts: Discount[] = $state([]);
	let errors: Record<string, string> = $state({});

	let formData: CreateEnrollmentRequest = $state({
		estudiante_id: '',
		curso_id: '',
		descuento_personalizado: 0,
		descuento_id: ''
	});

	// ISSUE-REFACTOR (UI): el Select de Estado usaba valores que no existen
	// en el enum real del backend (EstadoInscripcion: pendiente_pago | activo |
	// suspendido | completado | cancelado) -- 'inactivo'/'pendiente' habrían
	// fallado con 422 al enviarse. Corregido a los valores reales.
	let editData = $state({
		estado: 'activo',
		total_a_pagar: 0,
		total_pagado: 0,
		saldo_pendiente: 0
	});

	onMount(async () => {
		try {
			const res = await discountService.getAll(1, 100);
			discounts = res.data;
		} catch (e) {
			console.error('Error fetching discounts', e);
		}
	});

	$effect(() => {
		if (enrollment) {
			formData = {
				estudiante_id: enrollment.estudiante_id,
				curso_id: enrollment.curso_id,
				descuento_personalizado: enrollment.descuento_personalizado,
				descuento_id: ''
			};
			editData = {
				estado: enrollment.estado,
				total_a_pagar: Number(enrollment.total_a_pagar.toFixed(2)),
				total_pagado: Number(enrollment.total_pagado.toFixed(2)),
				saldo_pendiente: Number(enrollment.saldo_pendiente.toFixed(2))
			};
		} else {
			formData = {
				estudiante_id: '',
				curso_id: '',
				descuento_personalizado: 0,
				descuento_id: ''
			};
			editData = {
				estado: 'activo',
				total_a_pagar: 0,
				total_pagado: 0,
				saldo_pendiente: 0
			};
		}
		errors = {};
	});

	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};
		if (!isEditMode) {
			if (!formData.estudiante_id) nuevosErrores.estudiante_id = 'Selecciona un estudiante.';
			if (!formData.curso_id) nuevosErrores.curso_id = 'Selecciona un curso.';
		}
		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit() {
		// AUDITORÍA: guard explícito contra doble submit.
		if (saving) return;
		if (!validarFormulario()) return;

		saving = true;
		try {
			if (isEditMode && enrollment) {
				// NOTA (encontrado al verificar este formulario): el schema real
				// del backend (EnrollmentUpdate) NUNCA acepta total_a_pagar/
				// total_pagado/saldo_pendiente -- Pydantic los descarta en
				// silencio si se envían. Son campos 100% calculados por la
				// cascada de pagos (actualizar_saldo_enrollment) y no se pueden
				// editar manualmente vía este endpoint. Por eso el candado de
				// "desbloquear edición" nunca los incluye en el payload real;
				// solo se muestran de forma editable en la UI como referencia
				// visual de que existen, con la advertencia correspondiente.
				const updateData: any = {
					estado: editData.estado,
					descuento_personalizado: formData.descuento_personalizado
				};
				if (formData.descuento_id) {
					updateData.descuento_id = formData.descuento_id;
				}

				await enrollmentService.update(enrollment._id, updateData);
				alert('success', 'Inscripción actualizada correctamente');
			} else {
				const createData = { ...formData };
				if (!createData.descuento_id) {
					delete createData.descuento_id;
				}
				await enrollmentService.create(createData);
				alert('success', 'Inscripción creada correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar inscripción');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		{#if !isEditMode}
			<Select label="Estudiante" bind:value={formData.estudiante_id} required error={errors.estudiante_id}>
				<option value="">Seleccione un estudiante</option>
				{#each students as student}
					<option value={student._id}>{student.nombre} ({student.registro})</option>
				{/each}
			</Select>
			<Select label="Curso" bind:value={formData.curso_id} required error={errors.curso_id}>
				<option value="">Seleccione un curso</option>
				{#each courses as course}
					<option value={course._id}>{course.nombre_programa}</option>
				{/each}
			</Select>
		{:else}
			<!-- Read-only fields for edit mode -->
			<div class="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
				<p class="text-sm text-gray-500 dark:text-gray-400">Estudiante</p>
				<p class="font-medium text-gray-900 dark:text-white">
					{students.find((s) => s._id === formData.estudiante_id)?.nombre || 'Desconocido'}
				</p>
				<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Curso</p>
				<p class="font-medium text-gray-900 dark:text-white">
					{courses.find((c) => c._id === formData.curso_id)?.nombre_programa || 'Desconocido'}
				</p>
			</div>
		{/if}

		<Select label="Descuento Personal (Beca)" bind:value={formData.descuento_id}>
			<option value="">Ninguno</option>
			{#each discounts as discount}
				<option value={discount._id}>{discount.nombre} ({discount.porcentaje}%)</option>
			{/each}
		</Select>

		{#if isEditMode}
			<Select label="Estado" bind:value={editData.estado} required>
				<option value="pendiente_pago">Pendiente de Pago</option>
				<option value="activo">Activo</option>
				<option value="suspendido">Suspendido</option>
				<option value="completado">Completado</option>
				<option value="cancelado">Cancelado</option>
			</Select>
		{/if}
	</div>

	{#if isEditMode}
		<Card variant="bordered" padding="md">
			<p class="text-sm font-bold text-gray-800 dark:text-gray-200">Montos Financieros (solo lectura)</p>
			<p class="mt-1 flex items-start gap-1.5 text-xs text-light-warning dark:text-dark-warning">
				<ExclamationCircleIcon class="mt-0.5 size-3.5 shrink-0" />
				Estos valores son calculados automáticamente por el sistema en cascada a partir de los pagos
				reales (no se pueden editar desde aquí). Para corregir un saldo, registra o anula el pago
				correspondiente desde la sección de Pagos.
			</p>

			<div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
				<Input label="Total a Pagar" id="total_a_pagar" type="number" value={editData.total_a_pagar} disabled />
				<Input label="Total Pagado" id="total_pagado" type="number" value={editData.total_pagado} disabled />
				<Input
					label="Saldo Pendiente"
					id="saldo_pendiente"
					type="number"
					value={editData.saldo_pendiente}
					disabled
				/>
			</div>
		</Card>
	{/if}

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
