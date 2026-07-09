<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { Assignment, Submission } from '$lib/interfaces';
	import { MAX_SUBMISSION_ATTEMPTS } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { alert } from '$lib/utils';

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

	let attemptsUsed = $derived(existing?.attempt_count ?? 0);
	let attemptsLeft = $derived(MAX_SUBMISSION_ATTEMPTS - attemptsUsed);
	let limitReached = $derived(attemptsUsed >= MAX_SUBMISSION_ATTEMPTS);

	const ALLOWED_TYPES = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'image/jpeg', 'image/png', 'image/webp'
	];

	function handleFileSelect(f: File | null) {
		if (!f) {
			selectedFile = null;
			return;
		}
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
	<!-- Contador de intentos -->
	{#if existing}
		{#if limitReached}
			<div class="rounded-md bg-light-error/10 dark:bg-dark-error/10 border border-light-error/30 dark:border-dark-error/30 px-3 py-2">
				<p class="text-sm font-medium text-light-error dark:text-dark-error">Límite de entregas alcanzado</p>
				<p class="text-xs text-light-error/80 dark:text-dark-error/80 mt-0.5">
					Has utilizado los {MAX_SUBMISSION_ATTEMPTS} intentos permitidos para esta actividad.
					{#if existing.score != null}
						Tu nota: <strong>{existing.score}</strong>
					{/if}
				</p>
			</div>
		{:else}
			<div class="rounded-md bg-light-warning/10 dark:bg-dark-warning/10 border border-light-warning/30 dark:border-dark-warning/30 px-3 py-2">
				<p class="text-xs text-light-warning dark:text-dark-warning">
					Intento {attemptsUsed} de {MAX_SUBMISSION_ATTEMPTS} usado.
					Te {attemptsLeft === 1 ? 'queda 1 intento' : `quedan ${attemptsLeft} intentos`}.
					Al enviar de nuevo, se reemplazará la entrega anterior.
				</p>
			</div>
		{/if}
	{:else}
		<div class="rounded-md bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 px-3 py-2">
			<p class="text-xs text-primary-700 dark:text-primary-300">
				Tienes {MAX_SUBMISSION_ATTEMPTS} intentos para esta actividad.
			</p>
		</div>
	{/if}

	{#if !limitReached}
		<TextArea
			label="Respuesta / Comentario"
			id="sub-text"
			bind:value={textContent}
			rows={5}
			maxlength={5000}
			placeholder="Escribe tu respuesta aquí..."
		/>

		<FileUpload
			label="Archivo adjunto (opcional)"
			id="sub-file"
			accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
			file={selectedFile}
			onFileSelect={handleFileSelect}
			initialUrl={existing?.file_url}
			isEditable={!!existing}
		/>
	{/if}

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			{limitReached ? 'Cerrar' : 'Cancelar'}
		</Button>
		{#if !limitReached}
			<Button type="submit" {loading}>
				{existing ? 'Actualizar Entrega' : 'Enviar Entrega'}
			</Button>
		{/if}
	</div>
</form>
