<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { classroomService } from '$lib/services';
	import type { Classroom } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import ClassroomForm from '$lib/features/classroom/ClassroomForm.svelte';
	import { alert } from '$lib/utils';
	import { AcademicCapIcon } from '$lib/icons/outline';
	import { PlusIcon } from '$lib/icons/outline';

	onMount(() => {
		if ($userStore.loginType === 'student') {
			goto('/app/classroom/estudiante', { replaceState: true });
			return;
		}
		loadClasses();
	});

	let classes: Classroom[] = $state([]);
	let loading = $state(false);
	let showForm = $state(false);
	let selectedClassroom = $state<Classroom | null>(null);

	async function loadClasses() {
		loading = true;
		try {
			classes = await classroomService.getMyClasses();
		} catch (e: any) {
			alert('error', e.message || 'Error al cargar clases');
		} finally {
			loading = false;
		}
	}

	function handleCreate() {
		selectedClassroom = null;
		showForm = true;
	}

	function handleEdit(c: Classroom) {
		selectedClassroom = c;
		showForm = true;
	}

	function handleFormSuccess(c: Classroom) {
		showForm = false;
		loadClasses();
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Classroom — Vista Docente</Heading>
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nueva Clase
		</Button>
	</div>

	{#if loading}
		<TableSkeleton columns={3} rows={4} />
	{:else if classes.length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow border border-dashed border-gray-300 dark:border-gray-600">
			<AcademicCapIcon class="mx-auto size-12 text-gray-300 dark:text-gray-600 mb-4" />
			<p class="text-gray-500 dark:text-gray-400 font-medium">No tienes clases creadas aún.</p>
			<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Crea tu primera clase con el botón "Nueva Clase".</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each classes as classroom}
				<Card>
					<div class="flex items-start justify-between gap-2">
						<a href={`/app/classroom/clase/${classroom._id}`} class="flex items-start gap-3 min-w-0 flex-1">
							<div class="flex-shrink-0 p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg mt-0.5">
								<AcademicCapIcon class="size-5 text-primary-600 dark:text-primary-400" />
							</div>
							<div class="min-w-0">
								<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{classroom.nombre}</p>
								{#if classroom.descripcion}
									<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{classroom.descripcion}</p>
								{/if}
								<span class={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classroom.activo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600'}`}>
									{classroom.activo ? 'Activa' : 'Inactiva'}
								</span>
							</div>
						</a>
						<button
							onclick={() => handleEdit(classroom)}
							class="flex-shrink-0 p-1 text-gray-400 hover:text-primary-600 transition-colors"
							title="Editar"
						>
							<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</button>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<Modal
	isOpen={showForm}
	title={selectedClassroom ? 'Editar Clase' : 'Nueva Clase'}
	onClose={() => showForm = false}
	maxWidth="sm:max-w-lg"
>
	<ClassroomForm
		classroom={selectedClassroom}
		onSuccess={handleFormSuccess}
		onCancel={() => showForm = false}
	/>
</Modal>
