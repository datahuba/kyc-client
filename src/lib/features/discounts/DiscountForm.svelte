<script lang="ts">
	import { discountService } from '$lib/services';
	import type { CreateDiscountRequest, Discount, Student } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
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

	let formData: CreateDiscountRequest = $state({
		nombre: '',
		porcentaje: 0,
		lista_estudiantes: [],
		activo: true,
		nota_minima_requerida: null
	});

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
			if (isEditMode && discount) {
				await discountService.update(discount._id, formData);
				alert('success', 'Descuento actualizado correctamente');
			} else {
				await discountService.create(formData);
				alert('success', 'Descuento creado correctamente');
			}
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
				class={!isNameValid && formData.nombre.length > 0 ? "border-red-500 ring-red-500" : ""}
			/>
			{#if !isNameValid && formData.nombre.length > 0}
				<p class="text-xs text-red-500 font-medium">El nombre debe tener al menos 2 caracteres útiles.</p>
			{/if}
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
				class={!isPercentageValid && formData.porcentaje !== 0 ? "border-red-500 ring-red-500" : ""}
			/>
			<!-- BUG 9 FIX: Feedback visual instantáneo para el operador de Cobranzas -->
			{#if formData.porcentaje !== null && formData.porcentaje !== undefined}
				{#if Number(formData.porcentaje) <= 0}
					<p class="text-xs text-red-500 font-medium flex items-center gap-1">
						<svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
						No se permiten descuentos del 0% o negativos.
					</p>
				{:else if Number(formData.porcentaje) > 100}
					<p class="text-xs text-red-500 font-medium flex items-center gap-1">
						<svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
						El descuento no puede superar el 100%.
					</p>
				{/if}
			{/if}
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
