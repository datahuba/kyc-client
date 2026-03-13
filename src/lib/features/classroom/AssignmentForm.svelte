<script lang="ts">
	import { classroomService } from '$lib/services';
	import type { Assignment, AssignmentType, CreateAssignmentRequest } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
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

	async function handleSubmit(e: Event) {
		e.preventDefault();
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
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Tipo <span class="text-red-500">*</span>
		</label>
		<div class="flex gap-4">
			{#each [{ value: 'TASK', label: 'Tarea' }, { value: 'EXAM', label: 'Examen' }] as opt}
				<label class="flex items-center gap-2 cursor-pointer">
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

	<!-- Título -->
	<div>
		<label for="asg-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Título <span class="text-red-500">*</span>
		</label>
		<input
			id="asg-title"
			type="text"
			bind:value={form.title}
			required
			maxlength="200"
			placeholder="Ej: Tarea 1 — Análisis exploratorio"
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		/>
	</div>

	<!-- Descripción -->
	<div>
		<label for="asg-desc" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Descripción
		</label>
		<textarea
			id="asg-desc"
			bind:value={form.description}
			rows="3"
			maxlength="2000"
			placeholder="Instrucciones detalladas..."
			class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		></textarea>
	</div>

	<!-- Fecha límite + Nota máxima -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="asg-due" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
				Fecha límite
			</label>
			<input
				id="asg-due"
				type="datetime-local"
				bind:value={form.due_at}
				class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			/>
		</div>
		<div>
			<label for="asg-score" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
				Nota máxima
			</label>
			<input
				id="asg-score"
				type="number"
				bind:value={form.max_score}
				min="0"
				step="1"
				class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			/>
		</div>
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
