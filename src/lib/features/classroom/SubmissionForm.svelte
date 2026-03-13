<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { Assignment, Submission } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';
	import { UploadIcon } from '$lib/icons/outline';

	interface Props {
		assignment: Assignment;
		existing?: Submission | null;
		onSuccess: (submission: Submission) => void;
		onCancel: () => void;
	}

	let { assignment, existing = null, onSuccess, onCancel }: Props = $props();

	let textContent = $state(existing?.text_content ?? '');
	let selectedFile = $state<File | null>(null);
	let loading = $state(false);

	const ALLOWED_TYPES = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'image/jpeg', 'image/png', 'image/webp'
	];

	function handleFileChange(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		if (!ALLOWED_TYPES.includes(f.type)) {
			alert('error', 'Tipo no permitido. Use PDF, Word o imágenes.');
			return;
		}
		if (f.size > 20 * 1024 * 1024) {
			alert('error', 'El archivo no puede superar 20 MB.');
			return;
		}
		selectedFile = f;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!textContent.trim() && !selectedFile) {
			alert('error', 'Debes incluir texto o un archivo.');
			return;
		}
		loading = true;
		try {
			const result = await classroomService.submit(
				assignment.classroom_id,
				assignment._id,
				textContent.trim() || undefined,
				selectedFile ?? undefined
			);
			alert('success', existing ? 'Entrega actualizada' : 'Entrega enviada correctamente');
			onSuccess(result);
		} catch (err: any) {
			alert('error', err.message || 'Error al enviar entrega');
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if existing}
		<div class="text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md px-3 py-2 text-yellow-800 dark:text-yellow-300">
			Ya tienes una entrega registrada. Al enviar de nuevo, se reemplazará.
		</div>
	{/if}

	<!-- Texto -->
	<div>
		<label for="sub-text" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Respuesta / Comentario
		</label>
		<textarea
			id="sub-text"
			bind:value={textContent}
			rows="5"
			maxlength="5000"
			placeholder="Escribe tu respuesta aquí..."
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		></textarea>
	</div>

	<!-- Archivo -->
	<div>
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Archivo adjunto (opcional)
		</label>
		<label
			class="flex items-center gap-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 cursor-pointer hover:border-primary-400 transition-colors"
		>
			<UploadIcon class="size-5 text-gray-400" />
			<span class="text-sm text-gray-600 dark:text-gray-400">
				{selectedFile ? selectedFile.name : existing?.file_url ? 'Reemplazar archivo actual' : 'Seleccionar archivo (PDF, Word, imagen)'}
			</span>
			<input
				type="file"
				class="sr-only"
				accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
				onchange={handleFileChange}
			/>
		</label>
	</div>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading}>
			{existing ? 'Actualizar Entrega' : 'Enviar Entrega'}
		</Button>
	</div>
</form>
