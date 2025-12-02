<script lang="ts">
	import { onMount } from 'svelte';
	import { paymentService, studentService, courseService, enrollmentService } from '$lib/services';
	import type { CreatePaymentRequest, Payment, Student, Course, Enrollment } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';

	interface Props {
		payment?: Payment | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { payment = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!payment);
	let saving = $state(false);
	let loading = $state(false);

	let students: Student[] = $state([]);
	let courses: Course[] = $state([]);
	let enrollments: Enrollment[] = $state([]);

	let formData: CreatePaymentRequest = $state({
		inscripcion_id: '',
		estudiante_id: '',
		curso_id: '',
		numero_transaccion: '',
		concepto: '',
		cantidad_pago: 0,
		descuento_aplicado: 0,
		imagen_voucher_url: '',
		numero_cuota: 1
	});

	let editData = $state({
		estado_pago: 'pendiente',
		fecha_pagada: ''
	});

	onMount(async () => {
		loading = true;
		try {
			const [studentsData, coursesData, enrollmentsData] = await Promise.all([
				studentService.getAll(0, 1000),
				courseService.getAll(0, 1000),
				enrollmentService.getAll(0, 1000)
			]);
			students = studentsData;
			courses = coursesData;
			enrollments = enrollmentsData;
		} catch (e: any) {
			alert('error', 'Error al cargar datos');
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		if (payment) {
			formData = {
				inscripcion_id: payment.inscripcion_id,
				estudiante_id: payment.estudiante_id,
				curso_id: payment.curso_id,
				numero_transaccion: payment.numero_transaccion,
				concepto: payment.concepto,
				cantidad_pago: payment.cantidad_pago,
				descuento_aplicado: payment.descuento_aplicado,
				imagen_voucher_url: payment.imagen_voucher_url,
				numero_cuota: 1 // Default or fetch if available
			};
			editData = {
				estado_pago: payment.estado_pago,
				fecha_pagada: '' // Not in interface but might be useful
			};
		} else {
			formData = {
				inscripcion_id: '',
				estudiante_id: '',
				curso_id: '',
				numero_transaccion: '',
				concepto: '',
				cantidad_pago: 0,
				descuento_aplicado: 0,
				imagen_voucher_url: '',
				numero_cuota: 1
			};
			editData = {
				estado_pago: 'pendiente',
				fecha_pagada: ''
			};
		}
	});

	function handleEnrollmentChange(enrollmentId: string) {
		const enrollment = enrollments.find(e => e._id === enrollmentId);
		if (enrollment) {
			formData.estudiante_id = enrollment.estudiante_id;
			formData.curso_id = enrollment.curso_id;
		}
	}

	async function handleSubmit() {
		saving = true;
		try {
			if (isEditMode && payment) {
				await paymentService.update(payment._id, {
					...formData,
					estado_pago: editData.estado_pago,
					fecha_pagada: editData.fecha_pagada || undefined
				});
				alert('success', 'Pago actualizado correctamente');
			} else {
				await paymentService.create(formData);
				alert('success', 'Pago creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar pago');
		} finally {
			saving = false;
		}
	}
</script>

{#if loading}
	<div class="flex justify-center py-12">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
	</div>
{:else}
	<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#if !isEditMode}
				<div class="md:col-span-2">
					<Select
						label="Inscripción (Estudiante - Curso)"
						bind:value={formData.inscripcion_id}
						onchange={() => handleEnrollmentChange(formData.inscripcion_id)}
						required
					>
						<option value="">Seleccione una inscripción</option>
						{#each enrollments as enrollment}
							{@const s = students.find(s => s._id === enrollment.estudiante_id)}
							{@const c = courses.find(c => c._id === enrollment.curso_id)}
							<option value={enrollment._id}>
								{s?.nombre || 'Unknown'} - {c?.nombre_programa || 'Unknown'} ({enrollment.saldo_pendiente} pendiente)
							</option>
						{/each}
					</Select>
				</div>
			{:else}
				<div class="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
					<p class="text-sm text-gray-500 dark:text-gray-400">Estudiante</p>
					<p class="font-medium text-gray-900 dark:text-white">{students.find(s => s._id === formData.estudiante_id)?.nombre || 'Desconocido'}</p>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Curso</p>
					<p class="font-medium text-gray-900 dark:text-white">{courses.find(c => c._id === formData.curso_id)?.nombre_programa || 'Desconocido'}</p>
				</div>
			{/if}

			<Input
				label="Concepto"
				id="concepto"
				bind:value={formData.concepto}
				required
				placeholder="Matrícula..."
			/>
			<Input
				label="Número de Transacción"
				id="numero_transaccion"
				bind:value={formData.numero_transaccion}
				required
				placeholder="TRX-..."
			/>
			<Input
				label="Monto"
				id="cantidad_pago"
				type="number"
				bind:value={formData.cantidad_pago}
				required
			/>
			<Input
				label="Descuento Aplicado"
				id="descuento_aplicado"
				type="number"
				bind:value={formData.descuento_aplicado}
				required
			/>
			<Input
				label="Número de Cuota"
				id="numero_cuota"
				type="number"
				bind:value={formData.numero_cuota}
				required
			/>
			<Input
				label="URL Voucher"
				id="imagen_voucher_url"
				bind:value={formData.imagen_voucher_url}
				placeholder="https://..."
			/>

			{#if isEditMode}
				<Select
					label="Estado"
					bind:value={editData.estado_pago}
					required
				>
					<option value="pendiente">Pendiente</option>
					<option value="aprobado">Aprobado</option>
					<option value="rechazado">Rechazado</option>
				</Select>
				<Input
					label="Fecha Pagada"
					id="fecha_pagada"
					type="datetime-local"
					bind:value={editData.fecha_pagada}
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
{/if}
