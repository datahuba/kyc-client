<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import { paymentConfigService } from '$lib/services';
	import type { PaymentConfig } from '$lib/interfaces';
	import { alert } from '$lib/utils';
	import { UploadIcon, PencilIcon } from '$lib/icons/outline';

	interface Props {
		initialData?: PaymentConfig | null;
		onSuccess?: () => void;
		onCancel?: () => void;
	}

	let { initialData = null, onSuccess, onCancel }: Props = $props();

	let loading = $state(false);
	let errors: Record<string, string> = $state({});

	// Form fields
	let numero_cuenta = $state(initialData?.numero_cuenta || '');
	let banco = $state(initialData?.banco || '');
	let titular = $state(initialData?.titular || '');
	let tipo_cuenta = $state(initialData?.tipo_cuenta || '');
	let notas = $state(initialData?.notas || '');
	// ISSUE-REFACTOR (UI): `fileInput` estaba declarado como `let` plano
	// (asignado via bind:this), lo que svelte-check marcaba como
	// "actualizado pero no reactivo" (non_reactive_update). Usar $state
	// para que cualquier lectura reactiva de esta referencia sea correcta.
	let fileInput: HTMLInputElement | undefined = $state(undefined);
	let previewUrl: string | null = $state(initialData?.qr_url || null);
	let file: File | null = $state(null);

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			file = target.files[0];
			previewUrl = URL.createObjectURL(file);
		}
	}

	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};
		if (!numero_cuenta?.trim()) {
			nuevosErrores.numero_cuenta = 'El número de cuenta es obligatorio.';
		}
		if (!initialData && !file) {
			nuevosErrores.file = 'El código QR es obligatorio para crear la configuración.';
		}
		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validarFormulario()) {
			if (errors.file) alert('error', errors.file);
			return;
		}
		loading = true;

		try {
			const formData = new FormData();
			formData.append('numero_cuenta', numero_cuenta);
			if (banco) formData.append('banco', banco);
			if (titular) formData.append('titular', titular);
			if (tipo_cuenta) formData.append('tipo_cuenta', tipo_cuenta);
			if (notas) formData.append('notas', notas);
			if (file) formData.append('file', file);

			if (initialData) {
				await paymentConfigService.update(formData);
				alert('success', 'Configuración actualizada correctamente');
			} else {
				await paymentConfigService.create(formData);
				alert('success', 'Configuración creada correctamente');
			}

			if (onSuccess) onSuccess();
		} catch (error: any) {
			console.error(error);
			alert('error', error.message || 'Error al guardar configuración');
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- QR Image Upload -->
		<div
			class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 transition-colors hover:bg-gray-50 md:col-span-2 dark:border-gray-700 dark:hover:bg-gray-800/50"
		>
			{#if previewUrl}
				<div class="relative mb-4">
					<img src={previewUrl} alt="QR Preview" class="max-h-64 rounded-md object-contain shadow-sm" />
					<button
						type="button"
						class="absolute top-2 right-2 max-w-fit rounded-full bg-white p-1.5 shadow hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
						onclick={() => fileInput?.click()}
						title="Cambiar imagen"
						aria-label="Cambiar imagen del código QR"
					>
						<PencilIcon class="size-4 text-gray-600 dark:text-gray-300" />
					</button>
				</div>
				<input
					type="file"
					class="hidden"
					accept="image/*"
					bind:this={fileInput}
					onchange={handleFileChange}
				/>
			{:else}
				<div class="text-center">
					<UploadIcon class="mx-auto h-12 w-12 text-gray-400" />
					<div class="mt-4 flex text-sm leading-6 text-gray-600 dark:text-gray-400">
						<label
							for="file-upload"
							class="relative cursor-pointer rounded-md bg-white font-semibold text-primary-600 hover:text-primary-500 focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 focus-within:outline-none dark:bg-gray-900"
						>
							<span>Sube una imagen</span>
							<input
								id="file-upload"
								name="file-upload"
								type="file"
								class="sr-only"
								accept="image/*"
								bind:this={fileInput}
								onchange={handleFileChange}
							/>
						</label>
						<p class="pl-1">o arrastra y suelta</p>
					</div>
					<p class="text-xs leading-5 text-gray-600 dark:text-gray-400">PNG, JPG, WEBP hasta 5MB</p>
				</div>
			{/if}
		</div>

		<!-- Fields -->
		<Input
			label="Número de Cuenta"
			id="numero_cuenta"
			bind:value={numero_cuenta}
			required
			error={errors.numero_cuenta}
		/>

		<Input label="Banco" id="banco" bind:value={banco} />

		<Input label="Titular" id="titular" bind:value={titular} />

		<Select label="Tipo de Cuenta" id="tipo_cuenta" bind:value={tipo_cuenta}>
			<option value="">Seleccione...</option>
			<option value="Ahorro">Caja de Ahorro</option>
			<option value="Corriente">Cuenta Corriente</option>
		</Select>

		<div class="md:col-span-2">
			<TextArea label="Notas Adicionales" id="notas" bind:value={notas} rows={3} />
		</div>
	</div>

	<div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
		{#if onCancel}
			<Button type="button" variant="secondary" onclick={onCancel} disabled={loading}>Cancelar</Button>
		{/if}
		<Button type="submit" {loading}>
			{initialData ? 'Actualizar' : 'Crear'} Configuración
		</Button>
	</div>
</form>
