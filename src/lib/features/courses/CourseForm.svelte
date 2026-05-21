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
		costo_total_externo: null,
		matricula_externo: null,
		cantidad_cuotas: 1,
		descuento_curso: 0,
		descuento_id: '',
		observacion: '',
		fecha_inicio: '',
		fecha_fin: '',
		activo: true,
		modulos: [{ nombre: 'Módulo 1', costo: 0 }]
	});
	
	// Variables "espía" para saber cuándo recalcular el dinero
	let prevCuotas = $state(1);
	let prevCostoTotal = $state(0);
	let trackedCourseId = $state<string | undefined>(undefined);

	onMount(async () => {
		try {
			const res = await discountService.getAll(1, 100);
			discounts = res.data;
		} catch (e) {
			console.error('Error fetching discounts', e);
		}
	});

	// Efecto para cargar los datos cuando se abre el modal
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
					costo_total_externo: course.costo_total_externo ?? null,
					matricula_externo: course.matricula_externo ?? null,
					cantidad_cuotas: course.cantidad_cuotas,
					descuento_curso: course.descuento_curso,
					descuento_id: (course as any).descuento_id || '',
					observacion: course.observacion,
					fecha_inicio: course.fecha_inicio.split('T')[0],
					fecha_fin: course.fecha_fin.split('T')[0],
					activo: course.activo,
					modulos: course.modulos ? [...course.modulos] : Array.from({ length: course.cantidad_cuotas || 1 }, (_, i) => ({ nombre: `Módulo ${i + 1}`, costo: 0 }))
				};
				prevCuotas = course.cantidad_cuotas;
				prevCostoTotal = course.costo_total_interno;
			} else {
				// Resetear formulario para Curso Nuevo
				formData = {
					codigo: '',
					nombre_programa: '',
					tipo_curso: 'curso',
					modalidad: 'presencial',
					costo_total_interno: 0,
					matricula_interno: 0,
					costo_total_externo: null,
					matricula_externo: null,
					cantidad_cuotas: 1,
					descuento_curso: 0,
					descuento_id: '',
					observacion: '',
					fecha_inicio: '',
					fecha_fin: '',
					activo: true,
					modulos: [{ nombre: 'Módulo 1', costo: 0 }]
				};
				prevCuotas = 1;
				prevCostoTotal = 0;
			}
			trackedCourseId = currentId;
		}
	});

	// LA CEREZA DEL PASTEL: El cerebro matemático reactivo
	$effect(() => {
		// Evitar calcular si aún no se abrió el modal
		if (trackedCourseId === undefined) return;

		const count = formData.cantidad_cuotas || 0;
		const totalCosto = formData.costo_total_interno || 0;

		let changedArray = false;
		let newModulos = formData.modulos ? [...formData.modulos] : [];

		// 1. Ajustar cantidad de casillas (Si el jefe sube a 5, creamos 5 casillas)
		if (count !== newModulos.length) {
			if (count > newModulos.length) {
				while (newModulos.length < count) {
					newModulos.push({ nombre: `Módulo ${newModulos.length + 1}`, costo: 0 });
				}
			} else {
				newModulos = newModulos.slice(0, count);
			}
			changedArray = true;
		}

		// 2. REPARTICIÓN AUTOMÁTICA DE DINERO
		// Si el jefe cambió el Costo Total o la Cantidad de Cuotas, dividimos el dinero equitativamente
		if (count !== prevCuotas || totalCosto !== prevCostoTotal) {
			const costoUnitario = count > 0 ? Number((totalCosto / count).toFixed(2)) : 0;
			newModulos = newModulos.map(m => ({
				nombre: m.nombre, // Mantiene el nombre que le pusiste ("Módulo 1", "Tesis", etc)
				costo: costoUnitario // Sobreescribe el costo con la división exacta
			}));
			changedArray = true;
			
			// Actualizar los espías para no entrar en bucle
			prevCuotas = count;
			prevCostoTotal = totalCosto;
		}

		if (changedArray) {
			formData.modulos = newModulos;
		}
	});

	async function handleSubmit() {
		saving = true;
		try {
			const payload = { ...formData };
			if (!payload.descuento_id) {
				delete payload.descuento_id;
			}

			if (payload.costo_total_externo === null || payload.costo_total_externo === undefined || payload.costo_total_externo === '') {
				payload.costo_total_externo = 0;
			}
			if (payload.matricula_externo === null || payload.matricula_externo === undefined || payload.matricula_externo === '') {
				payload.matricula_externo = 0;
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
		<Input label="Código" id="codigo" bind:value={formData.codigo} required placeholder="DIPL-2024-001" />
		<Input label="Nombre del Programa" id="nombre_programa" bind:value={formData.nombre_programa} required placeholder="Diplomado en..." />
		
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
						
		<Input label="Fecha Inicio" id="fecha_inicio" type="date" bind:value={formData.fecha_inicio} required />
		<Input label="Fecha Fin" id="fecha_fin" type="date" bind:value={formData.fecha_fin} required />

		<div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
			<Heading level="h3" class="mb-4 text-lg">Costos Internos</Heading>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input label="Costo Total" id="costo_total_interno" type="number" bind:value={formData.costo_total_interno} required />
				<Input label="Matrícula" id="matricula_interno" type="number" bind:value={formData.matricula_interno} required />
			</div>
		</div>

		<div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
			<Heading level="h3" class="mb-4 text-lg">Costos Externos (Opcional)</Heading>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input label="Costo Total" id="costo_total_externo" type="number" bind:value={formData.costo_total_externo} />
				<Input label="Matrícula" id="matricula_externo" type="number" bind:value={formData.matricula_externo} />
			</div>
		</div>

		<div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
			<Input
				label="Cantidad de Módulos (Cuotas)"
				id="cantidad_cuotas"
				type="number"
				min="1"
				bind:value={formData.cantidad_cuotas}
				required
			/>
			<Select label="Descuento Global" bind:value={formData.descuento_id}>
				<option value="">Ninguno</option>
				{#each discounts as discount}
					<option value={discount._id}>{discount.nombre} ({discount.porcentaje}%)</option>
				{/each}
			</Select>
		</div>

		<!-- SECCIÓN DINÁMICA DE MÓDULOS -->
		{#if formData.modulos && formData.modulos.length > 0}
			<div class="md:col-span-2 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
				<Heading level="h3" class="mb-4 text-md text-primary-600">Configuración de Módulos (Auto-calculado)</Heading>
				<div class="grid grid-cols-1 gap-4">
					{#each formData.modulos as modulo, i}
						<div class="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
							<span class="font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 w-8 h-8 flex items-center justify-center rounded-full shrink-0">{i + 1}</span>
							<div class="flex-1 w-full">
								<Input label="Nombre del Módulo" id={`modulo_nombre_${i}`} bind:value={formData.modulos[i].nombre} required placeholder="Ej: Introducción a la IA" />
							</div>
							<div class="w-full md:w-1/3">
								<Input label="Costo (Bs)" id={`modulo_costo_${i}`} type="number" bind:value={formData.modulos[i].costo} required placeholder="Ej: 588" />
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="md:col-span-2 pt-2">
			<TextArea label="Observación" id="observacion" bind:value={formData.observacion} rows={3} />
		</div>
	</div>

	<div class="flex items-center gap-2 pt-4">
		<input type="checkbox" id="activo" bind:checked={formData.activo} class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">Curso Activo</label>
	</div>

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>Cancelar</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>