<script lang="ts">
	import { enrollmentService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';
	import type { Course, CreateEnrollmentRequest, Enrollment, Student } from '$lib/interfaces';

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

	let formData: CreateEnrollmentRequest = $state({
		estudiante_id: '',
		curso_id: '',
		descuento_personalizado: 0
	});

	let editData = $state({
		estado: 'activo',
		total_a_pagar: 0,
		total_pagado: 0,
		saldo_pendiente: 0
	});

	$effect(() => {
		if (enrollment) {
			formData = {
				estudiante_id: enrollment.estudiante_id,
				curso_id: enrollment.curso_id,
				descuento_personalizado: enrollment.descuento_personalizado
			};
			editData = {
				estado: enrollment.estado,
				total_a_pagar: enrollment.total_a_pagar,
				total_pagado: enrollment.total_pagado,
				saldo_pendiente: enrollment.saldo_pendiente
			};
		} else {
			formData = {
				estudiante_id: '',
				curso_id: '',
				descuento_personalizado: 0
			};
			editData = {
				estado: 'activo',
				total_a_pagar: 0,
				total_pagado: 0,
				saldo_pendiente: 0
			};
		}
	});

	async function handleSubmit() {
		saving = true;
		try {
			if (isEditMode && enrollment) {
				await enrollmentService.update(enrollment._id, {
					estado: editData.estado,
					descuento_personalizado: formData.descuento_personalizado,
					total_a_pagar: editData.total_a_pagar,
					total_pagado: editData.total_pagado,
					saldo_pendiente: editData.saldo_pendiente
				});
				alert('success', 'Inscripción actualizada correctamente');
			} else {
				await enrollmentService.create(formData);
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
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#if !isEditMode}
				<Select
					label="Estudiante"
					bind:value={formData.estudiante_id}
					required
				>
					<option value="">Seleccione un estudiante</option>
					{#each students as student}
						<option value={student._id}>{student.nombre} ({student.registro})</option>
					{/each}
				</Select>
				<Select
					label="Curso"
					bind:value={formData.curso_id}
					required
				>
					<option value="">Seleccione un curso</option>
					{#each courses as course}
						<option value={course._id}>{course.nombre_programa}</option>
					{/each}
				</Select>
			{:else}
				<!-- Read-only fields for edit mode -->
				<div class="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
					<p class="text-sm text-gray-500 dark:text-gray-400">Estudiante</p>
					<p class="font-medium text-gray-900 dark:text-white">{students.find(s => s._id === formData.estudiante_id)?.nombre || 'Desconocido'}</p>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Curso</p>
					<p class="font-medium text-gray-900 dark:text-white">{courses.find(c => c._id === formData.curso_id)?.nombre_programa || 'Desconocido'}</p>
				</div>
			{/if}

			<Input
				label="Descuento Personalizado"
				id="descuento_personalizado"
				type="number"
				bind:value={formData.descuento_personalizado}
				required
			/>

			{#if isEditMode}
				<Select
					label="Estado"
					bind:value={editData.estado}
					required
				>
					<option value="activo">Activo</option>
					<option value="inactivo">Inactivo</option>
					<option value="pendiente">Pendiente</option>
				</Select>
				<Input
					label="Total a Pagar"
					id="total_a_pagar"
					type="number"
					bind:value={editData.total_a_pagar}
					required
				/>
				<Input
					label="Total Pagado"
					id="total_pagado"
					type="number"
					bind:value={editData.total_pagado}
					required
				/>
				<Input
					label="Saldo Pendiente"
					id="saldo_pendiente"
					type="number"
					bind:value={editData.saldo_pendiente}
					required
				/>
			{/if}
		</div>

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

