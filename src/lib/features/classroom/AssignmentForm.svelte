<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { Assignment, AssignmentType, CreateAssignmentRequest } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import { alert } from '$lib/utils';

	interface Props {
		classroomId: string;
		assignment?: Assignment | null;
		onSuccess: (assignment: Assignment) => void;
		onCancel: () => void;
	}

	let { classroomId, assignment = null, onSuccess, onCancel }: Props = $props();

	let form = $state<CreateAssignmentRequest>({
		title: assignment?.title ?? '',
		description: assignment?.description ?? '',
		type: (assignment?.type as AssignmentType) ?? 'TASK',
		due_at: assignment?.due_at ? assignment.due_at.slice(0, 16) : '',
		max_score: assignment?.max_score ?? 100
	});
	let loading = $state(false);
	let errors: Record<string, string> = $state({});

	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};
		if (!form.title?.trim()) {
			nuevosErrores.title = 'El título es obligatorio.';
		}
		if (form.max_score === null || form.max_score === undefined || Number(form.max_score) < 0) {
			nuevosErrores.max_score = 'La nota máxima no puede ser negativa.';
		}
		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validarFormulario()) return;

		loading = true;
		try {
			const payload: CreateAssignmentRequest = {
				title: form.title.trim(),
				description: form.description?.trim() || undefined,
				type: form.type,
				due_at: form.due_at || undefined,
				max_score: Number(form.max_score)
			};

			let result: Assignment;
			if (assignment) {
				result = await classroomService.updateAssignment(classroomId, assignment._id, payload);
				alert('success', 'Actividad actualizada');
			} else {
				result = await classroomService.createAssignment(classroomId, payload);
				alert('success', 'Actividad creada correctamente');
			}
			onSuccess(result);
		} catch (err: any) {
			alert('error', err.message || 'Error al guardar la actividad');
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<!-- Tipo -->
	<div>
		<span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
			Tipo <span class="text-light-error">*</span>
		</span>
		<div class="flex gap-4">
			{#each [{ value: 'TASK', label: 'Tarea' }, { value: 'EXAM', label: 'Examen' }] as opt}
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="radio"
						bind:group={form.type}
						value={opt.value}
						class="text-primary-600 focus:ring-primary-600"
					/>
					<span class="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
				</label>
			{/each}
		</div>
	</div>

	<Input
		label="Título"
		id="asg-title"
		bind:value={form.title}
		required
		maxlength={200}
		placeholder="Ej: Tarea 1 — Análisis exploratorio"
		error={errors.title}
	/>

	<TextArea
		label="Descripción"
		id="asg-desc"
		bind:value={form.description}
		rows={3}
		maxlength={2000}
		placeholder="Instrucciones detalladas..."
	/>

	<div class="grid grid-cols-2 gap-4">
		<Input label="Fecha límite" id="asg-due" type="datetime-local" bind:value={form.due_at} />
		<Input
			label="Nota máxima"
			id="asg-score"
			type="number"
			bind:value={form.max_score}
			min={0}
			step="1"
			error={errors.max_score}
		/>
	</div>

	<div class="flex justify-end gap-3 pt-2">
		<Button variant="secondary" type="button" onclick={onCancel} disabled={loading}>
			Cancelar
		</Button>
		<Button type="submit" {loading}>
			{assignment ? 'Actualizar' : 'Crear Actividad'}
		</Button>
	</div>
</form>
