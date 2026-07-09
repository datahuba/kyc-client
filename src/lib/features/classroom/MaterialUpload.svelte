<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { ClassroomMaterial } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { alert } from '$lib/utils';

	interface Props {
		classroomId: string;
		onSuccess: (material: ClassroomMaterial) => void;
		onCancel: () => void;
	}

	let { classroomId, onSuccess, onCancel }: Props = $props();

	const ALLOWED_TYPES = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'image/jpeg',
		'image/png',
		'image/webp'
	];

	let title = $state('');
	let selectedFile = $state<File | null>(null);
	let loading = $state(false);

	function handleFileSelect(f: File | null) {
		if (!f) {
			selectedFile = null;
			return;
		}
		if (!ALLOWED_TYPES.includes(f.type)) {
			alert('error', 'Tipo de archivo no permitido. Use PDF, Word, PPT, Excel o imágenes.');
			return;
		}
		if (f.size > 20 * 1024 * 1024) {
			alert('error', 'El archivo no puede superar 20 MB.');
			return;
		}
		selectedFile = f;
		if (!title) title = f.name.replace(/\.[^.]+$/, '');
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!selectedFile) {
			alert('error', 'Selecciona un archivo.');
			return;
		}
		loading = true;
		try {
			const material = await classroomService.uploadMaterial(classroomId, selectedFile, title.trim());
			alert('success', 'Material subido correctamente');
			onSuccess(material);
		} catch (err: any) {
			alert('error', err.message || 'Error al subir material');
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<FileUpload
		label="Archivo"
		id="material-file-input"
		accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
		file={selectedFile}
		onFileSelect={handleFileSelect}
	/>
	<p class="text-xs text-gray-400 dark:text-gray-500 -mt-2">PDF, Word, PPT, Excel, imágenes · máx. 20 MB</p>

	<Input
		label="Título"
		id="mat-title"
		bind:value={title}
		required
		maxlength={200}
		placeholder="Ej: Semana 1 — Introducción a Python"
	/>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading} disabled={!selectedFile}>
			Subir Material
		</Button>
	</div>
</form>
