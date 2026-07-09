<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import type { Course } from '$lib/interfaces';

	interface Props {
		isOpen: boolean;
		importLoading: boolean;
		importFile: File | null;
		importCursoId: string;
		importReport: { success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[]; marcados_por_color?: Record<string, string[]> } | null;
		courses: Course[];
		onClose: () => void;
		onDownloadTemplate: () => void;
		onFileChange: (e: Event) => void;
		onSubmit: () => void;
	}

	let {
		isOpen,
		importLoading,
		importFile = $bindable(),
		importCursoId = $bindable(),
		importReport = $bindable(),
		courses = [],
		onClose,
		onDownloadTemplate,
		onFileChange,
		onSubmit
	}: Props = $props();

	// Solo cursos activos son elegibles para auto-inscripción
	const activeCourses = $derived(courses.filter((c) => c.activo));
	const selectedCourse = $derived(activeCourses.find((c) => c._id === importCursoId) ?? null);
</script>

<Modal {isOpen} title="Importación Masiva de Estudiantes (Excel)" onClose={() => { if (!importLoading) onClose(); }} maxWidth="sm:max-w-2xl">
	<div class="p-6 space-y-6">
		<div class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
			<p>Sube una hoja de cálculo con la lista de estudiantes para registrarlos en lote de manera automática.</p>
			<ul class="text-xs list-disc pl-4 space-y-1">
				<li>El sistema detecta automáticamente columnas de Nombre, Apellido, Carnet, Registro, Email, Celular, Domicilio, Fecha de Nacimiento y Grupo Sanguíneo (sin importar el orden).</li>
				<li>La fecha de nacimiento se interpreta automáticamente, sin importar si el archivo la trae en formato DD/MM/AAAA o MM/DD/AAAA.</li>
				<li>Si un carnet trae un complemento con guion (ej. "2726683 - 1J"), se separa: el número se usa para el CI y el complemento se guarda aparte (visible en el detalle del estudiante).</li>
				<li>Si el archivo no trae columna de Registro, se usa el Carnet (ya limpio) como usuario/registro.</li>
				<li>La contraseña inicial siempre es <span class="font-mono">Uagrm.&lt;CI&gt;</span> (misma convención que docentes/staff).</li>
				<li>Si el archivo marca filas con colores y trae una leyenda (ej. una celda amarilla junto al texto "Descuento Facultad"), el reporte final indicará qué estudiantes quedaron marcados con cada color — no se crea ni asigna ningún descuento automáticamente, eso lo decides tú después.</li>
			</ul>
		</div>

		<div class="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">¿No tienes la plantilla?</span>
			<Button onclick={onDownloadTemplate} variant="secondary" class="text-xs py-1 px-3">Descargar Plantilla</Button>
		</div>

		<div class="grid grid-cols-1 gap-4">
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

		<!-- Auto-inscripción opcional a un curso/diplomado -->
		<div class="space-y-1">
			<label for="import-curso" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
				Inscribir automáticamente a un curso <span class="text-gray-400 font-normal">(opcional)</span>
			</label>
			<select
				id="import-curso"
				bind:value={importCursoId}
				class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
			>
				<option value="">No inscribir (solo registrar estudiantes)</option>
				{#each activeCourses as course (course._id)}
					<option value={course._id}>{course.nombre_programa}</option>
				{/each}
			</select>
			{#if selectedCourse}
				<p class="text-xs text-primary-600 dark:text-primary-400 pt-1">
					Todos los estudiantes de esta importación se inscribirán automáticamente en
					<span class="font-semibold">{selectedCourse.nombre_programa}</span>.
					Si el archivo incluye columnas de pago (Matrícula, M1, M2…), esos montos se registrarán como pagos aprobados. Si incluye un link de comprobante de matrícula, se registrará como pago pendiente de verificación con el enlace adjunto.
				</p>
			{/if}
		</div>

		{#if importReport}
			<div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3 max-h-60 overflow-y-auto">
				<h4 class="text-sm font-bold text-gray-800 dark:text-white">Reporte de Procesamiento:</h4>
				<p class="text-xs text-green-600 dark:text-green-400 font-semibold">✓ {importReport.success_count} estudiantes importados con éxito.</p>
				{#if importReport.enrolled_count > 0}
					<p class="text-xs text-blue-600 dark:text-blue-400 font-semibold">✓ {importReport.enrolled_count} estudiantes inscritos automáticamente al curso seleccionado.</p>
				{/if}
				{#if importReport.migrated_payments_count > 0}
					<p class="text-xs text-blue-600 dark:text-blue-400 font-semibold">✓ {importReport.migrated_payments_count} estudiantes con pagos históricos migrados (matrícula/módulos).</p>
				{/if}
				{#if importReport.matricula_vouchers_count > 0}
					<p class="text-xs text-amber-600 dark:text-amber-400 font-semibold">✓ {importReport.matricula_vouchers_count} comprobantes de matrícula registrados como pago PENDIENTE (requieren verificación de Cobranza/CPD).</p>
				{/if}
				{#if importReport.marcados_por_color && Object.keys(importReport.marcados_por_color).length > 0}
					<div class="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
						<p class="text-xs font-bold text-amber-600 dark:text-amber-400">
							🎨 El archivo tenía filas marcadas con colores. Revisa manualmente si corresponde crear/asignar un descuento:
						</p>
						{#each Object.entries(importReport.marcados_por_color) as [significado, nombres]}
							<div class="text-[11px]">
								<span class="font-semibold text-gray-700 dark:text-gray-300">{significado} ({nombres.length}):</span>
								<span class="text-gray-500 dark:text-gray-400"> {nombres.join(', ')}</span>
							</div>
						{/each}
					</div>
				{/if}
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
