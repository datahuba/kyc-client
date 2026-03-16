<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { Classroom, CreateClassroomRequest } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';

	interface Props {
		classroom?: Classroom | null;
		onSuccess: (classroom: Classroom) => void;
		onCancel: () => void;
	}

	let { classroom = null, onSuccess, onCancel }: Props = $props();

	let form = $state<CreateClassroomRequest>({
		nombre: classroom?.nombre ?? '',
		descripcion: classroom?.descripcion ?? '',
		course_id: classroom?.course_id ?? ''
	});
	let loading = $state(false);
	const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const normalizedCourseId = form.course_id?.trim();
		if (normalizedCourseId && !OBJECT_ID_REGEX.test(normalizedCourseId)) {
			alert('error', 'El ID del curso debe tener 24 caracteres hexadecimales o dejarse vacío');
			return;
		}

		loading = true;
		try {
			const payload: CreateClassroomRequest = {
				nombre: form.nombre.trim(),
				descripcion: form.descripcion?.trim() || undefined,
				course_id: normalizedCourseId || undefined
			};
			let result: Classroom;
			if (classroom) {
				result = await classroomService.update(classroom._id, payload);
				alert('success', 'Clase actualizada correctamente');
			} else {
				result = await classroomService.create(payload);
				alert('success', 'Clase creada correctamente');
			}
			onSuccess(result);
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar la clase');
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<div>
		<label for="nombre" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Nombre <span class="text-red-500">*</span>
		</label>
		<input
			id="nombre"
			type="text"
			bind:value={form.nombre}
			required
			maxlength="200"
			placeholder="Ej: Diplomado en IA — Grupo A"
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		/>
	</div>

	<div>
		<label for="descripcion" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Descripción
		</label>
		<textarea
			id="descripcion"
			bind:value={form.descripcion}
			rows="3"
			maxlength="1000"
			placeholder="Descripción opcional de la clase..."
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		></textarea>
	</div>

	<div>
		<label for="course_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			ID del Curso (opcional)
		</label>
		<input
			id="course_id"
			type="text"
			bind:value={form.course_id}
			maxlength="24"
			pattern="[A-Fa-f0-9]{24}"
			title="Debe ser un ObjectId válido de 24 caracteres hexadecimales"
			placeholder="ID del curso asociado"
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		/>
	</div>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading}>
			{classroom ? 'Actualizar' : 'Crear Clase'}
		</Button>
	</div>
</form>
