<script lang="ts">
	import { discountService } from '$lib/services';
	import type { CreateDiscountRequest, Discount, Student } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';

	interface Props {
		discount?: Discount | null;
		students: Student[];
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { discount = null, students = [], onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!discount);
	let saving = $state(false);

	// ISSUE-P-DESCUENTO-RESOLUCION (fix 2026-07-09, reportado por el usuario):
	// la opción de subir el documento de resolución solo existía DESPUÉS de
	// crear el descuento (desde el dropdown de la lista). No es obligatorio
	// (confirmado por el usuario, puede quedar pendiente), pero la opción
	// debe estar visible desde el momento de crear/editar la beca.
	let resolucionFile: File | null = $state(null);

	let formData: CreateDiscountRequest = $state({
		nombre: '',
		porcentaje: 0,
		lista_estudiantes: [],
		activo: true,
		nota_minima_requerida: null
	});

	// BUG (2026-07-09, reportado por el usuario: "no pude seleccionar los
	// estudiantes para asignar becas cuando se cargan masivamente"): la prop
	// `students` se recibía pero nunca se usaba en el template -- no había
	// ningún selector visible. Se agrega multi-select con checkboxes (mismo
	// patrón de UserForm.svelte para cursos_asignados), con buscador porque
	// la lista de estudiantes puede tener decenas/cientos de registros.
	let studentSearch = $state('');
	let filteredStudents = $derived(
		studentSearch.trim()
			? students.filter((s) =>
					(s.nombre ?? '').toLowerCase().includes(studentSearch.trim().toLowerCase()) ||
					(s.carnet ?? '').includes(studentSearch.trim()) ||
					(s.registro ?? '').toLowerCase().includes(studentSearch.trim().toLowerCase())
				)
			: students
	);

	function toggleStudent(studentId: string) {
		const actuales = formData.lista_estudiantes ?? [];
		if (actuales.includes(studentId)) {
			formData.lista_estudiantes = actuales.filter((id) => id !== studentId);
		} else {
			formData.lista_estudiantes = [...actuales, studentId];
		}
	}

	// BUG 9 FIX: Validación reactiva y visual estricta
	let isNameValid = $derived(formData.nombre && formData.nombre.trim().length > 1);
	let isPercentageValid = $derived(
		formData.porcentaje !== null && 
		formData.porcentaje !== undefined && 
		!isNaN(Number(formData.porcentaje)) && 
		Number(formData.porcentaje) > 0 && 
		Number(formData.porcentaje) <= 100
	);

	let isFormValid = $derived(isNameValid && isPercentageValid);

	$effect(() => {
		if (discount) {
			formData = {
				nombre: discount.nombre,
				porcentaje: discount.porcentaje,
				lista_estudiantes: discount.lista_estudiantes,
				activo: discount.activo,
				nota_minima_requerida: discount.nota_minima_requerida ?? null
			};
		} else {
			formData = {
				nombre: '',
				porcentaje: 0,
				lista_estudiantes: [],
				activo: true,
				nota_minima_requerida: null
			};
		}
		resolucionFile = null;
	});

	async function handleSubmit() {
		// Doble blindaje lógico antes de enviar la petición (por si inyectan código en DOM)
		if (!isFormValid) {
			alert('error', 'Revisa los campos en rojo antes de guardar.');
			return;
		}

		formData.nombre = formData.nombre.trim();
		formData.porcentaje = Number(formData.porcentaje);

		saving = true;
		try {
			let savedDiscount: Discount;
			if (isEditMode && discount) {
				savedDiscount = await discountService.update(discount._id, formData);
			} else {
				savedDiscount = await discountService.create(formData);
			}

			// BUG (2026-07-09): DiscountCreate/DiscountUpdate no aceptan
			// lista_estudiantes en el payload principal (por diseño, para
			// forzar el uso de los endpoints dedicados add/removeStudent que
			// ya existían en el backend pero nunca se llamaban desde ninguna
			// UI). Se sincroniza aquí comparando contra la lista original.
			const originales = new Set(discount?.lista_estudiantes ?? []);
			const seleccionados = new Set(formData.lista_estudiantes ?? []);
			const aAgregar = [...seleccionados].filter((id) => !originales.has(id));
			const aQuitar = [...originales].filter((id) => !seleccionados.has(id));

			for (const studentId of aAgregar) {
				await discountService.addStudent(savedDiscount._id, studentId);
			}
			for (const studentId of aQuitar) {
				await discountService.removeStudent(savedDiscount._id, studentId);
			}

			// ISSUE-P-DESCUENTO-RESOLUCION: subir el respaldo si se seleccionó
			// un archivo, en el mismo submit (no bloqueante -- no es obligatorio).
			if (resolucionFile) {
				try {
					await discountService.uploadResolucion(savedDiscount._id, resolucionFile);
				} catch (uploadErr: any) {
					alert('warning', `El descuento se guardó, pero no se pudo subir el respaldo: ${uploadErr.message || 'error desconocido'}`);
				}
			}

			alert('success', isEditMode ? 'Descuento actualizado correctamente' : 'Descuento creado correctamente');
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar descuento');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div class="space-y-1">
			<Input
				label="Nombre del Descuento"
				id="nombre"
				bind:value={formData.nombre}
				required
				placeholder="Ej: Beca Excelencia"
				error={!isNameValid && formData.nombre.length > 0 ? 'El nombre debe tener al menos 2 caracteres útiles.' : undefined}
			/>
		</div>

		<div class="space-y-1">
			<Input
				label="Porcentaje (%)"
				id="porcentaje"
				type="number"
				min="0.01"
				max="100"
				step="0.01"
				bind:value={formData.porcentaje}
				required
				error={!isPercentageValid && formData.porcentaje !== 0
					? (Number(formData.porcentaje) <= 0
						? 'No se permiten descuentos del 0% o negativos.'
						: Number(formData.porcentaje) > 100
							? 'El descuento no puede superar el 100%.'
							: 'Ingresa un porcentaje entre 0.01 y 100.')
					: undefined}
			/>
		</div>
	</div>

	<!-- ISSUE-P-RECALCULO-NOTA: condición académica opcional para conservar la beca -->
	<div class="space-y-1">
		<Input
			label="Nota Mínima para Conservar la Beca (opcional)"
			id="nota_minima_requerida"
			type="number"
			min="0"
			max="100"
			step="0.01"
			bind:value={formData.nota_minima_requerida}
			placeholder="Ej: 77 (deja vacío si no aplica)"
		/>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Si se define, el estudiante debe mantener esta nota en cada módulo. Si reprueba el
			mínimo en un módulo específico, ese módulo (solo ese) pierde el descuento automáticamente.
		</p>
	</div>

	<!-- BUG (2026-07-09): selector real de estudiantes beneficiarios, antes ausente del formulario -->
	<div class="space-y-1">
		<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Estudiantes Beneficiarios ({(formData.lista_estudiantes ?? []).length} seleccionados)
		</p>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Marca los estudiantes que tendrán esta beca. También puedes asignarla individualmente desde
			la inscripción de cada estudiante (Editar Inscripción → Descuento Personal).
		</p>
		<Input
			id="student-search"
			bind:value={studentSearch}
			placeholder="Buscar por nombre, carnet o registro..."
		/>
		<div class="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
			{#if filteredStudents.length === 0}
				<p class="text-xs text-gray-400 dark:text-gray-500">No se encontraron estudiantes.</p>
			{:else}
				{#each filteredStudents as student (student._id)}
					<Checkbox
						id={`student_${student._id}`}
						label={`${student.nombre} (${student.registro})`}
						checked={(formData.lista_estudiantes ?? []).includes(student._id)}
						onchange={() => toggleStudent(student._id)}
					/>
				{/each}
			{/if}
		</div>
	</div>

	<!-- ISSUE-P-DESCUENTO-RESOLUCION: documento de resolución (opcional, no bloqueante) -->
	<div class="space-y-1">
		<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Documento de Resolución (opcional)
		</p>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Respalda institucionalmente este descuento. No es obligatorio: puedes crear la beca sin
			adjuntarlo ahora y subirlo/reemplazarlo después desde la lista de descuentos.
		</p>
		<FileUpload
			accept="application/pdf,image/jpeg,image/png,image/webp"
			file={resolucionFile}
			onFileSelect={(f) => (resolucionFile = f)}
			initialUrl={discount?.resolucion_url}
		/>
	</div>

	<div class="flex items-center gap-2 pt-4">
		<input
			type="checkbox"
			id="activo"
			bind:checked={formData.activo}
			class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
		/>
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Descuento Activo
		</label>
	</div>

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>
			Cancelar
		</Button>
		<!-- BUG 9 FIX: Botón apagado hasta que las matemáticas sean correctas -->
		<Button type="submit" loading={saving} disabled={!isFormValid}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>
