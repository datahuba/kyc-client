<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { ClassroomMaterial } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';
	import { UploadIcon } from '$lib/icons/outline';

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
	let dragOver = $state(false);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		if (f) validateAndSetFile(f);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) validateAndSetFile(f);
	}

	function validateAndSetFile(f: File) {
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

	function formatBytes(b: number): string {
		if (b < 1024) return `${b} B`;
		if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
		return `${(b / (1024 * 1024)).toFixed(1)} MB`;
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
	<!-- Drop zone -->
	<div
		role="button"
		tabindex="0"
		class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
			${dragOver ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}
		ondragover={(e) => { e.preventDefault(); dragOver = true; }}
		ondragleave={() => { dragOver = false; }}
		ondrop={handleDrop}
		onclick={() => document.getElementById('material-file-input')?.click()}
		onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('material-file-input')?.click(); }}
	>
		<input
			id="material-file-input"
			type="file"
			class="sr-only"
			accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
			onchange={handleFileChange}
		/>
		{#if selectedFile}
			<div class="text-sm">
				<p class="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
				<p class="text-gray-400 text-xs mt-0.5">{formatBytes(selectedFile.size)}</p>
				<p class="text-primary-600 text-xs mt-1">Clic para cambiar</p>
			</div>
		{:else}
			<UploadIcon class="mx-auto size-8 text-gray-400 mb-2" />
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Arrastra un archivo o <span class="text-primary-600 font-medium">haz clic para seleccionar</span>
			</p>
			<p class="text-xs text-gray-400 mt-1">PDF, Word, PPT, Excel, imágenes · máx. 20 MB</p>
		{/if}
	</div>

	<!-- Título -->
	<div>
		<label for="mat-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Título <span class="text-red-500">*</span>
		</label>
		<input
			id="mat-title"
			type="text"
			bind:value={title}
			required
			maxlength="200"
			placeholder="Ej: Semana 1 — Introducción a Python"
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		/>
	</div>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading} disabled={!selectedFile}>
			Subir Material
		</Button>
	</div>
</form>
