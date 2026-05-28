<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';

	interface Props {
		isOpen: boolean;
		importLoading: boolean;
		importFile: File | null;
		importTipoEstudiante: 'interno' | 'externo';
		importReport: { success_count: number; errors: string[] } | null;
		onClose: () => void;
		onDownloadTemplate: () => void;
		onFileChange: (e: Event) => void;
		onSubmit: () => void;
	}

	let {
		isOpen,
		importLoading,
		importFile = $bindable(),
		importTipoEstudiante = $bindable(),
		importReport = $bindable(),
		onClose,
		onDownloadTemplate,
		onFileChange,
		onSubmit
	}: Props = $props();
</script>

<Modal {isOpen} title="Importación Masiva de Estudiantes (Excel)" onClose={() => { if (!importLoading) onClose(); }} maxWidth="sm:max-w-2xl">
	<div class="p-6 space-y-6">
		<div class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
			<p>Sube una hoja de cálculo con la lista de estudiantes para registrarlos en lote de manera automática.</p>
		</div>

		<div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">¿No tienes la plantilla?</span>
			<Button onclick={onDownloadTemplate} variant="secondary" class="text-xs py-1 px-3">Descargar Plantilla</Button>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="space-y-1">
				<label for="import-tipo" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Estudiante a Registrar</label>
				<select
					id="import-tipo"
					bind:value={importTipoEstudiante}
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
				>
					<option value="externo">Externos (Público General)</option>
					<option value="interno">Internos (UAGRM)</option>
				</select>
			</div>
			
			<div class="space-y-1">
				<label for="import-file" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Selecciona el archivo (.xlsx)</label>
				<input
					id="import-file"
					type="file"
					accept=".xlsx, .xls, .csv"
					onchange={onFileChange}
					class="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-white"
				/>
			</div>
		</div>

		{#if importReport}
			<div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3 max-h-60 overflow-y-auto">
				<h4 class="text-sm font-bold text-gray-800 dark:text-white">Reporte de Procesamiento:</h4>
				<p class="text-xs text-green-600 dark:text-green-400 font-semibold">✓ {importReport.success_count} estudiantes importados con éxito.</p>
				{#if importReport.errors.length > 0}
					<div class="space-y-1">
						<p class="text-xs text-red-600 dark:text-red-400 font-semibold">⚠️ Se detectaron {importReport.errors.length} problemas en el archivo:</p>
						<ul class="list-disc pl-5 text-[11px] text-red-500 space-y-1">
							{#each importReport.errors as err}<li>{err}</li>{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
			<Button variant="secondary" onclick={onClose} disabled={importLoading}>Cancelar</Button>
			<Button onclick={onSubmit} loading={importLoading} disabled={!importFile}>Procesar Importación</Button>
		</div>
	</div>
</Modal>
