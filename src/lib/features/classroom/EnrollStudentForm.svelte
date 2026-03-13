<script lang="ts">
	import { onMount } from 'svelte';
	import { classroomService, studentService } from '$lib/services';
	import type { Student } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import { alert } from '$lib/utils';

	interface Props {
		classroomId: string;
		onSuccess: (student: Student) => void;
		onCancel: () => void;
	}

	let { classroomId, onSuccess, onCancel }: Props = $props();

	let query = $state('');
	let students = $state<Student[]>([]);
	let searching = $state(false);
	let enrollingStudentId = $state<string | null>(null);

	onMount(() => {
		loadStudents();
	});

	async function loadStudents() {
		searching = true;
		try {
			const response = await studentService.getAll(1, 20, {
				q: query.trim() || undefined,
				activo: true
			});
			students = response.data;
		} catch (error: any) {
			alert('error', error.message || 'Error al cargar estudiantes');
		} finally {
			searching = false;
		}
	}

	async function handleSearch(event: Event) {
		event.preventDefault();
		await loadStudents();
	}

	async function enrollStudent(student: Student) {
		enrollingStudentId = student._id;
		try {
			await classroomService.enrollStudent(classroomId, student._id);
			alert('success', `Estudiante inscrito: ${student.nombre}`);
			onSuccess(student);
		} catch (error: any) {
			alert('error', error.message || 'No se pudo inscribir al estudiante');
		} finally {
			enrollingStudentId = null;
		}
	}
</script>

<div class="space-y-4">
	<form onsubmit={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={query}
			placeholder="Buscar por nombre, email, carnet o registro"
			class="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		/>
		<Button type="submit" loading={searching}>
			Buscar
		</Button>
	</form>

	{#if searching}
		<div class="text-sm text-gray-500 dark:text-gray-400">Buscando estudiantes...</div>
	{:else if students.length === 0}
		<div class="text-sm text-gray-500 dark:text-gray-400">No se encontraron estudiantes activos.</div>
	{:else}
		<div class="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
			{#each students as student}
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<div class="min-w-0">
						<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{student.nombre}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
							{student.registro} • {student.email}
						</p>
					</div>
					<Button
						type="button"
						onclick={() => enrollStudent(student)}
						loading={enrollingStudentId === student._id}
						disabled={enrollingStudentId !== null && enrollingStudentId !== student._id}
					>
						Inscribir
					</Button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex justify-end pt-1">
		<Button variant="secondary" type="button" onclick={onCancel}>
			Cerrar
		</Button>
	</div>
</div>