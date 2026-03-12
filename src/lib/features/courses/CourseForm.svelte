<script lang="ts">
	import { courseService, discountService } from '$lib/services';
	import type { CreateCourseRequest, Course, Discount } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
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

	let formData: CreateCourseRequest = $state({
		codigo: '',
		nombre_programa: '',
		tipo_curso: 'curso',
		modalidad: 'presencial',
		costo_total_interno: 0,
		matricula_interno: 0,
		costo_total_externo: 0,
		matricula_externo: 0,
		cantidad_cuotas: 1,
		descuento_curso: 0,
		descuento_id: '',
		observacion: '',
		fecha_inicio: '',
		fecha_fin: '',
		activo: true
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
		if (course) {
			formData = {
				codigo: course.codigo,
				nombre_programa: course.nombre_programa,
				tipo_curso: course.tipo_curso,
				modalidad: course.modalidad,
				costo_total_interno: course.costo_total_interno,
				matricula_interno: course.matricula_interno,
				costo_total_externo: course.costo_total_externo,
				matricula_externo: course.matricula_externo,
				cantidad_cuotas: course.cantidad_cuotas,
				descuento_curso: course.descuento_curso,
				// Assuming course interface assumes descuento_id might be missing in old data
				// We don't have it in the Interface locally yet, but we updated it. 
				// However, if the backend sends it, we should use it. 
				// For now let's assume it might be there or not.
				descuento_id: (course as any).descuento_id || '',
				observacion: course.observacion,
				fecha_inicio: course.fecha_inicio.split('T')[0],
				fecha_fin: course.fecha_fin.split('T')[0],
				activo: course.activo
			};
		} else {
			formData = {
				codigo: '',
				nombre_programa: '',
				tipo_curso: 'curso',
				modalidad: 'presencial',
				costo_total_interno: 0,
				matricula_interno: 0,
				costo_total_externo: 0,
				matricula_externo: 0,
				cantidad_cuotas: 1,
				descuento_curso: 0,
				descuento_id: '',
				observacion: '',
				fecha_inicio: '',
				fecha_fin: '',
				activo: true
			};
		}
	});

	async function handleSubmit() {
		saving = true;
		try {
			const payload = { ...formData };
			if (!payload.descuento_id) {
				delete payload.descuento_id;
			}
			
			if (isEditMode && course) {
				const updatePayload = {
					...payload,
					inscritos: course.inscritos
				};
				await courseService.update(course._id, updatePayload);
				alert('success', 'Curso actualizado correctamente');
			} else {
				await courseService.create(payload);
				alert('success', 'Curso creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar curso');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<Input
			label="Código"
			id="codigo"
			bind:value={formData.codigo}
			required
			placeholder="DIPL-2024-001"
		/>
		<Input
			label="Nombre del Programa"
			id="nombre_programa"
			bind:value={formData.nombre_programa}
			required
			placeholder="Diplomado en..."
		/>
		<Select 
			label="Tipo de Curso"
			bind:value={formData.tipo_curso}
			required
		>
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

		<Select 
			label="Modalidad"
			bind:value={formData.modalidad}
			required
		>
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
		/>
		<Input
			label="Fecha Fin"
			id="fecha_fin"
			type="date"
			bind:value={formData.fecha_fin}
			required
		/>

		<div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
			<Heading level="h3" class="mb-4 text-lg">Costos Internos</Heading>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input
					label="Costo Total"
					id="costo_total_interno"
					type="number"
					bind:value={formData.costo_total_interno}
					required
				/>
				<Input
					label="Matrícula"
					id="matricula_interno"
					type="number"
					bind:value={formData.matricula_interno}
					required
				/>
			</div>
		</div>

		<div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
			<Heading level="h3" class="mb-4 text-lg">Costos Externos</Heading>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input
					label="Costo Total"
					id="costo_total_externo"
					type="number"
					bind:value={formData.costo_total_externo}
					required
				/>
				<Input
					label="Matrícula"
					id="matricula_externo"
					type="number"
					bind:value={formData.matricula_externo}
					required
				/>
			</div>
		</div>

		<div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
			<Input
				label="Cantidad de Cuotas"
				id="cantidad_cuotas"
				type="number"
				bind:value={formData.cantidad_cuotas}
				required
			/>
			<Select 
				label="Descuento Global"
				bind:value={formData.descuento_id}
			>
				<option value="">Ninguno</option>
				{#each discounts as discount}
					<option value={discount._id}>{discount.nombre} ({discount.porcentaje}%)</option>
				{/each}
			</Select>
			<!-- 
			<Input
				label="Descuento Curso (%)"
				id="descuento_curso"
				type="number"
				bind:value={formData.descuento_curso}
				required
			/>
			-->
		</div>

		<div class="md:col-span-2">
			<TextArea
				label="Observación"
				id="observacion"
				bind:value={formData.observacion}
				rows={3}
			/>
		</div>
	</div>

	<div class="flex items-center gap-2 pt-4">
		<input
			type="checkbox"
			id="activo"
			bind:checked={formData.activo}
			class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
		/>
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Curso Activo
		</label>
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
