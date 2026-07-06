<script lang="ts">
	import { onMount } from 'svelte';
	import { classroomService, courseService } from '$lib/services';
	import type { Classroom, CreateClassroomRequest, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import Select from '$lib/components/ui/select.svelte';
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
	let errors: Record<string, string> = $state({});

	// ISSUE-REFACTOR (UI): el curso se elegía escribiendo a mano un ObjectId
	// de 24 caracteres hexadecimales (alta fricción y propenso a error de
	// tipeo). Reemplazado por un Select con la lista real de cursos.
	let cursosDisponibles: Course[] = $state([]);

	onMount(async () => {
		try {
			const todos: Course[] = [];
			let currentPage = 1;
			let hasMore = true;
			while (hasMore) {
				const res = await courseService.getAll(currentPage, 100, { activo: true });
				todos.push(...res.data);
				hasMore = res.meta.hasNextPage;
				currentPage += 1;
			}
			cursosDisponibles = todos;
		} catch {
			cursosDisponibles = [];
		}
	});

	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};
		if (!form.nombre?.trim() || form.nombre.trim().length < 3) {
			nuevosErrores.nombre = 'El nombre debe tener al menos 3 caracteres.';
		}
		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validarFormulario()) return;

		loading = true;
		try {
			const payload: CreateClassroomRequest = {
				nombre: form.nombre.trim(),
				descripcion: form.descripcion?.trim() || undefined,
				course_id: form.course_id || undefined
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
	<Input
		label="Nombre"
		id="nombre"
		bind:value={form.nombre}
		required
		maxlength={200}
		placeholder="Ej: Diplomado en IA — Grupo A"
		error={errors.nombre}
	/>

	<TextArea
		label="Descripción"
		id="descripcion"
		bind:value={form.descripcion}
		rows={3}
		maxlength={1000}
		placeholder="Descripción opcional de la clase..."
	/>

	<Select label="Curso Asociado (opcional)" id="course_id" bind:value={form.course_id}>
		<option value="">Sin curso asociado</option>
		{#each cursosDisponibles as curso (curso._id)}
			<option value={curso._id}>{curso.nombre_programa} ({curso.codigo})</option>
		{/each}
	</Select>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading}>
			{classroom ? 'Actualizar' : 'Crear Clase'}
		</Button>
	</div>
</form>
